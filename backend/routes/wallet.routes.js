const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [user, orchardRegistration, paidClaims] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          farmerName: true,
          walletAddress: true,
        },
      }),
      prisma.orchardRegistration.findUnique({
        where: { userId },
        select: {
          accountNumber: true,
          accountName: true,
          bankName: true,
        },
      }),
      prisma.claim.findMany({
        where: {
          farm: { ownerId: userId },
          status: 'PAID',
        },
        include: {
          policy: { select: { coverageAmount: true } },
          farm: { select: { farmName: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const transactions = paidClaims.map((claim) => {
      const amountValue = Number(claim.policy?.coverageAmount);
      return {
        id: claim.id,
        label: `Payout — ${claim.diseaseType || claim.farm?.farmName || 'Claim'}`,
        amount: Number.isFinite(amountValue) ? amountValue : 0,
        date: claim.updatedAt,
        txHash: claim.txHash,
        farmName: claim.farm?.farmName || null,
      };
    });

    const balance = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    res.json({
      account: {
        name: user?.farmerName || user?.email || null,
        walletAddress: user?.walletAddress || null,
        accountNumber: orchardRegistration?.accountNumber || null,
        accountName: orchardRegistration?.accountName || null,
        bankName: orchardRegistration?.bankName || null,
      },
      balance,
      transactions,
    });
  } catch (error) {
    console.error('Wallet summary error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet summary' });
  }
});

module.exports = router;
