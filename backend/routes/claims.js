const express = require('express');
const axios = require('axios');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');

// Configuration
const NDVI_SERVICE_URL = process.env.NDVI_SERVICE_URL || 'http://localhost:8000';

const router = express.Router();

// Submit a disease claim
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { farmId, policyId, diseaseImageHash, diseaseType, diseaseSeverity } = req.body;
    const userId = req.user.userId;

    if (!farmId || !diseaseImageHash || !diseaseSeverity) {
      return res.status(400).json({ error: 'Farm ID, disease image hash, and severity are required' });
    }

    // Verify farm belongs to user
    const farm = await prisma.farm.findFirst({
      where: {
        id: Number(farmId),
        ownerId: userId,
      },
      select: { id: true },
    });

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // Create claim record
    const claim = await prisma.claim.create({
      data: {
        farmId: Number(farmId),
        policyId: policyId ? Number(policyId) : null,
        diseaseImageHash,
        diseaseType: diseaseType || null,
        diseaseSeverity: Number(diseaseSeverity),
        status: 'pending',
      },
    });

    // If severity is high enough, trigger NDVI verification
    if (Number(diseaseSeverity) > 0.6) {
      try {
        console.log(`🛰️  Triggering NDVI verification for farm ${farmId}`);

        const ndviResult = await axios.post(
          `${NDVI_SERVICE_URL}/api/ndvi/verify-claim`,
          {
            farm_id: farmId,
            current_ndvi: null // Let Python service fetch current
          },
          { timeout: 30000 }
        );

        // Update claim with NDVI results
        const updatedClaim = await prisma.claim.update({
          where: { id: claim.id },
          data: {
            ndviVerified: Boolean(ndviResult.data.verified),
            ndviBaseline: ndviResult.data.ndvi_baseline,
            ndviCurrent: ndviResult.data.ndvi_current,
            ndviDropPercentage: ndviResult.data.drop_percentage,
          },
        });

        return res.status(201).json({
          message: 'Claim submitted with NDVI verification',
          claim: updatedClaim,
          ndvi_data: ndviResult.data
        });
      } catch (ndviError) {
        console.warn('⚠️  NDVI verification failed, storing claim without NDVI data:', ndviError.message);

        return res.status(201).json({
          message: 'Claim submitted (NDVI verification unavailable)',
          claim,
          ndvi_error: ndviError.message
        });
      }
    }

    res.status(201).json({
      message: 'Claim submitted',
      claim
    });
  } catch (error) {
    console.error('Claim submission error:', error);
    res.status(500).json({ error: 'Claim submission failed' });
  }
});

// Get claims for user
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

    res.json({
      claims
    });
  } catch (error) {
    console.error('Fetch claims error:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Get claim by ID
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

    res.json({
      claim
    });
  } catch (error) {
    console.error('Fetch claim error:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

module.exports = router;
