const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create new farm
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { farmName, gpsPolygon } = req.body;
    const userId = req.user.userId;

    if (!farmName || !gpsPolygon) {
      return res.status(400).json({ error: 'Farm name and GPS polygon are required' });
    }

    const result = await pool.query(
      'INSERT INTO farms (owner_id, farm_name, gps_polygon) VALUES ($1, $2, $3) RETURNING *',
      [userId, farmName, JSON.stringify(gpsPolygon)]
    );

    res.status(201).json({
      message: 'Farm created successfully',
      farm: result.rows[0]
    });
  } catch (error) {
    console.error('Farm creation error:', error);
    res.status(500).json({ error: 'Farm creation failed' });
  }
});

// Get all farms for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM farms WHERE owner_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      farms: result.rows
    });
  } catch (error) {
    console.error('Fetch farms error:', error);
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// Get farm by ID
router.get('/:farmId', authenticateToken, async (req, res) => {
  try {
    const { farmId } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM farms WHERE id = $1 AND owner_id = $2',
      [farmId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json({
      farm: result.rows[0]
    });
  } catch (error) {
    console.error('Fetch farm error:', error);
    res.status(500).json({ error: 'Failed to fetch farm' });
  }
});

// Update farm
router.put('/:farmId', authenticateToken, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { farmName, gpsPolygon } = req.body;
    const userId = req.user.userId;

    const result = await pool.query(
      'UPDATE farms SET farm_name = COALESCE($1, farm_name), gps_polygon = COALESCE($2, gps_polygon), updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING *',
      [farmName, gpsPolygon ? JSON.stringify(gpsPolygon) : null, farmId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json({
      message: 'Farm updated successfully',
      farm: result.rows[0]
    });
  } catch (error) {
    console.error('Farm update error:', error);
    res.status(500).json({ error: 'Farm update failed' });
  }
});

module.exports = router;
