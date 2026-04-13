const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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
    const farmResult = await pool.query(
      'SELECT * FROM farms WHERE id = $1 AND owner_id = $2',
      [farmId, userId]
    );

    if (farmResult.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // Create claim record
    const claimResult = await pool.query(
      `INSERT INTO claims
       (farm_id, policy_id, disease_image_hash, disease_type, disease_severity, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [farmId, policyId || null, diseaseImageHash, diseaseType, diseaseSeverity]
    );

    const claim = claimResult.rows[0];

    // If severity is high enough, trigger NDVI verification
    if (diseaseSeverity > 0.6) {
      try {
        console.log(`🛰️  Triggering NDVI verification for farm ${farmId}`);

        const ndviResult = await axios.post(
          `${process.env.NDVI_SERVICE_URL || 'http://localhost:8000'}/api/ndvi/verify-claim`,
          {
            farm_id: farmId,
            current_ndvi: null // Let Python service fetch current
          },
          { timeout: 30000 }
        );

        // Update claim with NDVI results
        const updatedClaimResult = await pool.query(
          `UPDATE claims
           SET ndvi_verified = $1,
               ndvi_baseline = $2,
               ndvi_current = $3,
               ndvi_drop_percentage = $4
           WHERE id = $5
           RETURNING *`,
          [
            ndviResult.data.verified,
            ndviResult.data.ndvi_baseline,
            ndviResult.data.ndvi_current,
            ndviResult.data.drop_percentage,
            claim.id
          ]
        );

        return res.status(201).json({
          message: 'Claim submitted with NDVI verification',
          claim: updatedClaimResult.rows[0],
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

    const result = await pool.query(
      `SELECT c.* FROM claims c
       JOIN farms f ON c.farm_id = f.id
       WHERE f.owner_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({
      claims: result.rows
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

    const result = await pool.query(
      `SELECT c.* FROM claims c
       JOIN farms f ON c.farm_id = f.id
       WHERE c.id = $1 AND f.owner_id = $2`,
      [claimId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({
      claim: result.rows[0]
    });
  } catch (error) {
    console.error('Fetch claim error:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

module.exports = router;
