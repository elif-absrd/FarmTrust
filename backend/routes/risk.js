const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const { evaluateRisk } = require('../services/riskScoring');

const router = express.Router();

// Evaluate risk for a single farm input dataset.
router.post('/evaluate', authenticateToken, async (req, res) => {
  try {
    const { soilData, weatherData, cropHistoryData, farmId } = req.body;
    const userId = req.user.userId;

    if (!soilData || !weatherData || !cropHistoryData) {
      return res.status(400).json({
        error: 'soilData, weatherData, and cropHistoryData are required for risk evaluation',
      });
    }

    const evaluation = await evaluateRisk({
      soilData,
      weatherData,
      cropHistoryData,
      farmId: farmId ? Number(farmId) : null,
      userId,
    });

    return res.status(201).json({
      message: 'Risk evaluation completed successfully',
      evaluation,
    });
  } catch (error) {
    console.error('Risk evaluation error:', error);
    return res.status(500).json({ error: 'Failed to evaluate risk' });
  }
});

// Fetch risk evaluation logs for the authenticated user.
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const logs = await prisma.riskEvaluationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Failed to fetch risk evaluation logs:', error);
    return res.status(500).json({ error: 'Failed to fetch risk logs' });
  }
});

module.exports = router;
