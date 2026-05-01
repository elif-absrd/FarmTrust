/**
 * RISK ASSESSMENT API ROUTES
 * 
 * Exposes the Risk Scoring Engine as REST API endpoints
 * Can be integrated with Express.js or other Node.js web frameworks
 * 
 * Usage (in Express app):
 *   const riskRoutes = require('./riskRoutes');
 *   app.use('/api/risk', riskRoutes);
 */

const express = require('express');
const RiskAssessmentService = require('./service');

const router = express.Router();
const service = new RiskAssessmentService();

/**
 * ENDPOINT: POST /api/risk/assess
 * 
 * Perform a risk assessment for a farm
 * 
 * Request body:
 * {
 *   "farmId": "farm_001",
 *   "soilData": {
 *     "pH": 6.5,
 *     "moisture": 30,
 *     "nutrient": 3.0
 *   },
 *   "weatherData": {
 *     "temperature": 25,
 *     "humidity": 65,
 *     "rainfall": 150
 *   },
 *   "cropData": {
 *     "previousDiseaseRiskScore": 30,
 *     "pastDiseaseOccurrences": 2
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "recordId": 42,
 *   "assessment": { ... },
 *   "storedAt": "2026-04-30T10:30:00.000Z"
 * }
 */
router.post('/assess', async (req, res) => {
  try {
    const { farmId, soilData, weatherData, cropData } = req.body;

    const result = await service.assessFarm(farmId, soilData, weatherData, cropData);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINT: GET /api/risk/farm/:farmId
 * 
 * Get current status and statistics for a farm
 * 
 * Response:
 * {
 *   "success": true,
 *   "farmId": "farm_001",
 *   "latestAssessment": { ... },
 *   "statistics": { ... }
 * }
 */
router.get('/farm/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;

    const result = await service.getFarmStatus(farmId);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINT: GET /api/risk/farm/:farmId/history
 * 
 * Get assessment history for a farm
 * 
 * Query params:
 * - limit: Number of records (default: 10)
 * 
 * Response:
 * {
 *   "success": true,
 *   "farmId": "farm_001",
 *   "count": 5,
 *   "history": [ ... ]
 * }
 */
router.get('/farm/:farmId/history', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { limit = 10 } = req.query;

    const result = await service.getAssessmentHistory(farmId, parseInt(limit));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINT: GET /api/risk/farm/:farmId/statistics
 * 
 * Get detailed statistics and trends for a farm
 * 
 * Response:
 * {
 *   "success": true,
 *   "farmId": "farm_001",
 *   "statistics": { ... }
 * }
 */
router.get('/farm/:farmId/statistics', async (req, res) => {
  try {
    const { farmId } = req.params;

    const result = await service.getStatistics(farmId);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINT: GET /api/risk/flagged
 * 
 * Get all flagged assessments requiring review
 * Useful for administrative dashboards
 * 
 * Query params:
 * - limit: Maximum records (default: 50)
 * 
 * Response:
 * {
 *   "success": true,
 *   "count": 5,
 *   "flagged": [ ... ]
 * }
 */
router.get('/flagged', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await service.getFlaggedAssessments(parseInt(limit));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINT: PATCH /api/risk/assessment/:assessmentId
 * 
 * Update assessment status after review
 * 
 * Request body:
 * {
 *   "status": "under_review" | "resolved"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "record": { ... }
 * }
 */
router.patch('/assessment/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { status } = req.body;

    const result = await service.updateStatus(assessmentId, status);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ENDPOINT: POST /api/risk/initialize
 * 
 * Initialize database schema (development only)
 * In production, use proper Prisma migrations
 */
router.post('/initialize', async (req, res) => {
  try {
    const result = await service.initialize();

    res.status(200).json({
      success: result,
      message: result ? 'Database initialized' : 'Database initialization skipped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
