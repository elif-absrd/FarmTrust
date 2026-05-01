const prisma = require("../config/prisma");
const { uploadJSONToIPFS } = require("./ipfs.service");
const { triggerPayout, getPolygonscanTxUrl } = require("./blockchain.service");
const { fetchJsonFromIPFS, extractThreshold } = require("./pinata.service");
const { simulateRampConversion } = require("./ramp.service");

const SEVERITY_THRESHOLD = 0.2;
const TRUST_THRESHOLD = 0.65;

function normalizeRatio(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  if (num > 1 && num <= 100) {
    return num / 100;
  }
  return num;
}

function resolvePayoutAmount(amountOverride, policyAmount) {
  const candidate = amountOverride ?? policyAmount;
  if (candidate === null || candidate === undefined) {
    return null;
  }
  const amount = Number(candidate);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function resolveFarmTokenId(claim) {
  const candidates = [claim.farmTokenId, claim.farm?.farmTokenId];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }
    const tokenId = Number(candidate);
    if (Number.isFinite(tokenId) && tokenId > 0) {
      return tokenId;
    }
  }
  return null;
}

function resolveFarmerAddress(claim) {
  return claim.farmerWalletAddress || claim.farm?.owner?.walletAddress || null;
}

async function approveClaimAndTriggerPayout({ claimId, adminId, remarks, amount }) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      farm: {
        include: {
          owner: true,
          orchardRegistration: true,
        },
      },
      policy: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!claim) {
    const error = new Error("Claim not found");
    error.statusCode = 404;
    throw error;
  }

  if (!["PENDING", "UNDER_REVIEW", "APPROVED"].includes(claim.status)) {
    const error = new Error("Claim cannot be approved in current status");
    error.statusCode = 400;
    throw error;
  }

  const severityRatio = normalizeRatio(claim.diseaseSeverity);
  if (severityRatio === null) {
    const error = new Error("Disease severity is missing or invalid");
    error.statusCode = 400;
    throw error;
  }

  let ipfsHashes = claim.ipfsHashes;
  if (typeof claim.ipfsHashes === "string") {
    try {
      ipfsHashes = JSON.parse(claim.ipfsHashes);
    } catch (error) {
      ipfsHashes = null;
    }
  }
  const thresholdHash = ipfsHashes?.thresholdReportIpfsHash;
  let thresholdPayload = null;
  try {
    thresholdPayload = await fetchJsonFromIPFS(thresholdHash);
  } catch (error) {
    return await escalateClaim({
      claim,
      adminId,
      remarks: remarks || "Failed to fetch threshold from IPFS",
      reason: "Threshold fetch failed",
      severityRatio,
    });
  }
  const threshold = extractThreshold(thresholdPayload);

  if (threshold === null) {
    return await escalateClaim({
      claim,
      adminId,
      remarks: remarks || "Threshold not found in IPFS payload",
      reason: "Threshold missing or unreadable",
      severityRatio,
    });
  }

  if (severityRatio <= SEVERITY_THRESHOLD || threshold < TRUST_THRESHOLD) {
    return await escalateClaim({
      claim,
      adminId,
      remarks:
        remarks ||
        `Escalated: severity=${severityRatio} threshold=${threshold}`,
      reason:
        threshold < TRUST_THRESHOLD
          ? "Threshold below 0.65"
          : "Severity below 20%",
      severityRatio,
      threshold,
    });
  }

  const payoutAmount = resolvePayoutAmount(amount, claim.policy?.coverageAmount);
  if (!payoutAmount) {
    const error = new Error("Payout amount is missing or invalid");
    error.statusCode = 400;
    throw error;
  }

  const farmTokenId = resolveFarmTokenId(claim);
  if (farmTokenId === null) {
    const error = new Error("Farm token ID is missing");
    error.statusCode = 400;
    throw error;
  }

  const farmerAddress = resolveFarmerAddress(claim);
  if (!farmerAddress) {
    const error = new Error("Farmer wallet address is missing");
    error.statusCode = 400;
    throw error;
  }

  const payoutPayload = {
    claimId: claim.id,
    farmId: claim.farmId,
    farmTokenId,
    farmerAddress,
    amount: payoutAmount,
    adminId,
    severity: severityRatio,
    threshold,
    accountNumber: claim.farm.orchardRegistration?.accountNumber || null,
    accountName: claim.farm.orchardRegistration?.accountName || null,
    bankName: claim.farm.orchardRegistration?.bankName || null,
    timestamp: new Date().toISOString(),
  };

  const payoutIpfsHash = await uploadJSONToIPFS(payoutPayload);
  const txHash = await triggerPayout(
    farmerAddress,
    payoutAmount,
    farmTokenId,
    claim.id,
    payoutIpfsHash
  );

  const updatedClaim = await prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "PAID",
      txHash,
      approvedAt: new Date(),
      approvedBy: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      claimId: claim.id,
      action: "PAYOUT_TRIGGERED",
      trustScore: claim.trustScore,
      componentScores: claim.componentScores,
      imageIpfsHash: claim.auditLogs[0]?.imageIpfsHash,
      ndviReportIpfsHash: claim.auditLogs[0]?.ndviReportIpfsHash,
      thresholdReportIpfsHash: claim.auditLogs[0]?.thresholdReportIpfsHash,
      approvedBy: adminId,
      remarks:
        remarks ||
        `Payout triggered. threshold=${threshold} severity=${severityRatio} payoutIpfs=${payoutIpfsHash}`,
    },
  });

  const rampResult = await simulateRampConversion({
    txHash,
    amount: payoutAmount,
    farmerAddress,
    accountNumber: payoutPayload.accountNumber,
    accountName: payoutPayload.accountName,
    bankName: payoutPayload.bankName,
  });

  return {
    status: "PAID",
    message: "Claim approved and payout triggered",
    claim: updatedClaim,
    txHash,
    payoutIpfsHash,
    polygonscanUrl: getPolygonscanTxUrl(txHash),
    ramp: rampResult,
  };
}

async function escalateClaim({ claim, adminId, remarks, reason, severityRatio, threshold }) {
  const updatedClaim = await prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "UNDER_REVIEW",
      approvedAt: new Date(),
      approvedBy: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      claimId: claim.id,
      action: "ESCALATED",
      trustScore: claim.trustScore,
      componentScores: claim.componentScores,
      imageIpfsHash: claim.auditLogs[0]?.imageIpfsHash,
      ndviReportIpfsHash: claim.auditLogs[0]?.ndviReportIpfsHash,
      thresholdReportIpfsHash: claim.auditLogs[0]?.thresholdReportIpfsHash,
      approvedBy: adminId,
      remarks: remarks || reason || "Escalated for manual review",
    },
  });

  return {
    status: "ESCALATED",
    message: "Claim escalated for manual review",
    claim: updatedClaim,
    reason,
    threshold,
    severity: severityRatio,
  };
}

module.exports = { approveClaimAndTriggerPayout };
