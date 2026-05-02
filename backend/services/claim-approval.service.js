const prisma = require("../config/prisma");
const { uploadJSONToIPFS } = require("./ipfs.service");
const { triggerPayout, getPolygonscanTxUrl } = require("./blockchain.service");
const { fetchJsonFromIPFS, extractThreshold } = require("./pinata.service");
const { simulateRampConversion } = require("./ramp.service");
const { sendExpoPush } = require("./expo-push.service");

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
  // Accept any numeric value including 0 (used in testing)
  const candidates = [claim.farmTokenId, claim.farm?.farmTokenId, claim.farmId];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const tokenId = Number(candidate);
    if (Number.isFinite(tokenId) && tokenId >= 0) {
      return tokenId;
    }
  }
  // Ultimate fallback: use farmId
  return Number(claim.farmId) || 0;
}

function resolveFarmerAddress(claim) {
  const candidates = [claim.farmerWalletAddress, claim.farm?.owner?.walletAddress];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const addr = String(candidate).trim();
    if (!addr) continue;
    // Accept any valid EVM address
    if (/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      return addr;
    }
  }
  // In testing: generate a deterministic mock address from farmId so payouts can be simulated.
  const farmId = Number(claim.farmId) || 0;
  const mockAddr = `0x${String(farmId).padStart(40, '0')}`;
  console.warn(`[ClaimApproval] No valid wallet for farmer on farm #${farmId} — using mock address ${mockAddr} for testing.`);
  return mockAddr;
}

async function resolveThresholdForClaim({ claim, ipfsHashes, severityRatio, adminId, remarks, phase }) {
  const thresholdHash = ipfsHashes?.thresholdReportIpfsHash;

  // 1) Prefer IPFS threshold report when available.
  if (thresholdHash) {
    try {
      const payload = await fetchJsonFromIPFS(thresholdHash);
      const extracted = extractThreshold(payload);
      if (extracted !== null) {
        return { threshold: extracted, source: 'ipfs' };
      }
    } catch (error) {
      // fall through to trustScore fallback
      console.warn(`[ClaimApproval] ${phase}: threshold fetch failed, falling back to trustScore`, error?.message || error);
    }
  }

  // 2) Fallback: use claim.trustScore (already computed by Trust Score Engine).
  const trustScoreFallback = normalizeRatio(claim.trustScore);
  if (trustScoreFallback !== null) {
    return { threshold: trustScoreFallback, source: 'trustScore' };
  }

  // 3) No usable threshold → escalate.
  const escalated = await escalateClaim({
    claim,
    adminId,
    remarks: remarks || 'Threshold unavailable (no IPFS hash and no trustScore).',
    reason: 'Threshold missing or unreadable',
    severityRatio,
  });
  return { escalated, threshold: null, source: 'missing' };
}

async function approveClaimForPayout({ claimId, adminId, remarks }) {
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

  if (!["PENDING", "UNDER_REVIEW"].includes(claim.status)) {
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

  const thresholdResult = await resolveThresholdForClaim({
    claim,
    ipfsHashes,
    severityRatio,
    adminId,
    remarks,
    phase: 'approve',
  });

  if (thresholdResult.escalated) {
    return thresholdResult.escalated;
  }

  const threshold = thresholdResult.threshold;

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

  const updatedClaim = await prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: adminId,
    },
  });

  await prisma.auditLog.create({
    data: {
      claimId: claim.id,
      action: "APPROVED",
      trustScore: claim.trustScore,
      componentScores: claim.componentScores,
      imageIpfsHash: claim.auditLogs[0]?.imageIpfsHash,
      ndviReportIpfsHash: claim.auditLogs[0]?.ndviReportIpfsHash,
      thresholdReportIpfsHash: claim.auditLogs[0]?.thresholdReportIpfsHash,
      approvedBy: adminId,
      remarks: remarks || `Approved for payout. threshold=${threshold} severity=${severityRatio}`,
    },
  });

  return {
    status: "APPROVED",
    message: "Claim approved (ready for payout)",
    claim: updatedClaim,
    threshold,
    thresholdSource: thresholdResult.source,
    severity: severityRatio,
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

async function confirmPayoutForApprovedClaim({ claimId, adminId, amount, remarks }) {
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

  console.log(`[ClaimApproval Debug] Claim ID: ${claim.id}, Expected Status: APPROVED, Actual Status: ${claim.status}, Admin ID: ${adminId}, Approved By: ${claim.approvedBy}`);

  if (claim.status !== "APPROVED") {
    const error = new Error("Claim is not approved for payout");
    error.statusCode = 400;
    throw error;
  }

  if (claim.approvedBy && claim.approvedBy !== adminId) {
    const error = new Error("Only the approving admin can confirm payout");
    error.statusCode = 403;
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
    } catch {
      ipfsHashes = null;
    }
  }

  const thresholdResult = await resolveThresholdForClaim({
    claim,
    ipfsHashes,
    severityRatio,
    adminId,
    remarks,
    phase: 'confirm',
  });

  if (thresholdResult.escalated) {
    // If threshold is missing/unusable at confirm time, keep claim under review instead of hard failing.
    return thresholdResult.escalated;
  }

  const threshold = thresholdResult.threshold;

  if (severityRatio <= SEVERITY_THRESHOLD || threshold < TRUST_THRESHOLD) {
    return await escalateClaim({
      claim,
      adminId,
      remarks: remarks || `Escalated on confirm: severity=${severityRatio} threshold=${threshold}`,
      reason: threshold < TRUST_THRESHOLD ? "Threshold below 0.65" : "Severity below 20%",
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

  const farmerAddress = resolveFarmerAddress(claim);
  if (!farmerAddress) {
    const error = new Error(
      "Farmer wallet address is missing/invalid. Add a 0x... wallet address to the farmer profile (signup) before triggering payouts."
    );
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
  const txHash = await triggerPayout(farmerAddress, payoutAmount, farmTokenId, claim.id, payoutIpfsHash);

  const updatedClaim = await prisma.claim.update({
    where: { id: claim.id },
    data: {
      status: "PAID",
      txHash,
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
      remarks: remarks || `Payout triggered. threshold=${threshold} severity=${severityRatio} payoutIpfs=${payoutIpfsHash}`,
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

  let push = null;
  try {
    const expoPushToken = claim.farm?.owner?.expoPushToken;
    if (expoPushToken) {
      push = await sendExpoPush({
        expoPushToken,
        title: "✅ Payout Confirmed!",
        body: "Your crop insurance payout has been processed.",
        data: {
          txHash,
          polygonscanUrl: getPolygonscanTxUrl(txHash),
          claimId: claim.id,
        },
      });
    }
  } catch (error) {
    // Non-fatal: payout already triggered on-chain.
    console.warn("Failed to send Expo push notification", error?.message || error);
  }

  return {
    status: "PAID",
    message: "Payout confirmed and triggered",
    claim: updatedClaim,
    txHash,
    payoutIpfsHash,
    polygonscanUrl: getPolygonscanTxUrl(txHash),
    threshold,
    thresholdSource: thresholdResult.source,
    severity: severityRatio,
    ramp: rampResult,
    push,
  };
}

module.exports = { approveClaimForPayout, confirmPayoutForApprovedClaim };
