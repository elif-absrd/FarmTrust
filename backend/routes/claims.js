const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const RiskAssessmentService = require('../riskScoringEngine/service');

const router = express.Router();
const trustService = new RiskAssessmentService();

// Submit a disease claim and run the complete Trust Score Engine workflow.
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const result = await trustService.submitClaimWithTrustScore(req.user.userId, req.body);

    res.status(201).json({
      message: 'Claim submitted with Trust Score routing',
      claim: result.claim,
      trustScore: result.trustScore,
      componentScores: result.componentScores,
      routingTier: result.routingTier,
      status: result.status,
      reportHash: result.reportHash,
    });
  } catch (error) {
    console.error('Claim submission error:', error);
    const message = error instanceof Error ? error.message : 'Claim submission failed';
    const statusCode =
      message.includes('not found') ? 404 :
        message.includes('required') || message.includes('severity') ? 400 :
          500;
    res.status(statusCode).json({ error: message });
  }
});

// Get claims for user, including the Trust Score component fields used by admin review.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const claims = await prisma.claim.findMany({
      where: {
        farm: {
          ownerId: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ claims });
  } catch (error) {
    console.error('Fetch claims error:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Get claim by ID.
router.get('/:claimId', authenticateToken, async (req, res) => {
  try {
    const { claimId } = req.params;
    const userId = req.user.userId;

    const claim = await prisma.claim.findFirst({
      where: {
        id: Number(claimId),
        farm: {
          ownerId: userId,
        },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ claim });
  } catch (error) {
    console.error('Fetch claim error:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

module.exports = router;
