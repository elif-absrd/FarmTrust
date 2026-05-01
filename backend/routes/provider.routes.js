const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function requireProvider(req, res, next) {
  if (req.user.role !== 'PROVIDER') {
    return res.status(403).json({ error: 'Provider access required' });
  }
  next();
}

function statusLabel(status) {
  if (status === 'PAID' || status === 'APPROVED') return 'Smart Contract Triggered';
  if (status === 'UNDER_REVIEW') return 'Oracle Verifying';
  return 'Pending';
}

router.get('/dashboard', authenticateToken, requireProvider, async (req, res) => {
  try {
    const providerUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        farmerName: true,
        walletAddress: true,
      },
    });

    const [policies, claims] = await Promise.all([
      prisma.policy.findMany({
        include: {
          farm: {
            include: {
              owner: {
                select: {
                  id: true,
                  farmerName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.claim.findMany({
        include: {
          farm: {
            include: {
              owner: {
                select: {
                  id: true,
                  farmerName: true,
                },
              },
            },
          },
          policy: { select: { coverageAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const payoutClaims = claims.filter((claim) => claim.status === 'PAID');
    const payoutsDisbursed = payoutClaims.reduce((sum, claim) => {
      const amountValue = Number(claim.policy?.coverageAmount);
      return sum + (Number.isFinite(amountValue) ? amountValue : 0);
    }, 0);

    const pendingClaims = claims.filter((claim) =>
      ['PENDING', 'UNDER_REVIEW', 'SURVEYED_PENDING'].includes(claim.status),
    ).length;

    const verifiedClaims = claims.filter((claim) => claim.ndviVerified).length;
    const aiAccuracy = claims.length ? (verifiedClaims / claims.length) * 100 : 0;

    const policyRows = policies.map((policy) => {
      const coverageValue = Number(policy.coverageAmount);
      return {
        farmerId: policy.farm?.owner?.id || null,
        farmerName: policy.farm?.owner?.farmerName || policy.farm?.owner?.email || 'Unknown',
        plant: policy.cropType || policy.farm?.cropType || policy.farm?.orchardType || 'Unknown',
        coverageAmount: Number.isFinite(coverageValue) ? coverageValue : 0,
        status: policy.status || 'Active',
      };
    });

    const claimsQueue = claims.map((claim) => {
      const modelScore = Number(claim.diseaseSeverity);
      const trustScore = Number(claim.trustScore);
      return {
        farmerId: claim.farm?.owner?.id || null,
        farmerName: claim.farm?.owner?.farmerName || 'Unknown',
        disease: claim.diseaseType || 'Unknown',
        modelScore: Number.isFinite(modelScore) ? modelScore : null,
        trustScore: Number.isFinite(trustScore) ? trustScore : null,
        oracle: claim.ndviVerified ? 'Verified' : claim.trustScore !== null ? 'Pending' : 'Not started',
        status: statusLabel(claim.status),
      };
    });

    const rows = 5;
    const cols = 7;
    const heatmapGrid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    claims.forEach((claim) => {
      const idx = claim.farmId % (rows * cols);
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const severityValue = Number(claim.diseaseSeverity);
      let level = 0;
      if (Number.isFinite(severityValue)) {
        if (severityValue >= 0.7) level = 3;
        else if (severityValue >= 0.35) level = 2;
        else if (severityValue > 0) level = 1;
      }
      heatmapGrid[row][col] = Math.max(heatmapGrid[row][col], level);
    });

    res.json({
      providerAccount: {
        id: providerUser?.id || null,
        name: providerUser?.farmerName || providerUser?.email || null,
        email: providerUser?.email || null,
        walletAddress: providerUser?.walletAddress || null,
      },
      stats: {
        totalPolicies: policies.length,
        pendingClaims,
        payoutsDisbursed,
        aiAccuracy,
      },
      policies: policyRows,
      heatmap: {
        grid: heatmapGrid,
        levels: ['Low', 'Moderate', 'Elevated', 'High'],
      },
      claimsQueue,
    });
  } catch (error) {
    console.error('Provider dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch provider dashboard' });
  }
});

module.exports = router;
