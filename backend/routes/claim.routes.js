const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { approveClaimAndTriggerPayout } = require('../services/claim-approval.service');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// POST /api/claim/approve/:claimId
router.post('/approve/:claimId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { adminId, remarks, amount } = req.body;
    const tokenAdminId = req.user.userId;

    if (adminId && Number(adminId) !== tokenAdminId) {
      return res.status(403).json({ error: 'Admin ID mismatch' });
    }

    const result = await approveClaimAndTriggerPayout({
      claimId: parseInt(claimId),
      adminId: tokenAdminId,
      remarks,
      amount,
    });

    res.json(result);
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to approve claim' });
  }
});

module.exports = router;
