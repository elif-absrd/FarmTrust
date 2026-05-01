const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const { approveClaimAndTriggerPayout } = require('../services/claim-approval.service');

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * GET /api/admin/claims-pending-review
 * Get all claims pending review with their details
 */
router.get('/claims-pending-review', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      status: {
        in: status ? [status] : ['PENDING', 'UNDER_REVIEW'],
      },
    };

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        include: {
          farm: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  farmerName: true,
                  phone: true,
                },
              },
              orchardRegistration: {
                select: {
                  accountNumber: true,
                  accountName: true,
                  bankName: true,
                },
              },
            },
          },
          policy: true,
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.claim.count({ where }),
    ]);

    res.json({
      claims: claims.map((claim) => ({
        id: claim.id,
        claimId: `CLM-${String(claim.id).padStart(6, '0')}`,
        farmId: claim.farmId,
        farmerDetails: {
          name: claim.farm.owner.farmerName,
          email: claim.farm.owner.email,
          phone: claim.farm.owner.phone,
          walletAddress: claim.farmerWalletAddress,
        },
        orchardDetails: {
          name: claim.farm.farmName,
          type: claim.farm.orchardType,
          address: claim.farm.fullAddress,
          areaAcres: claim.farm.areaAcres,
          accountNumber: claim.farm.orchardRegistration?.accountNumber,
          accountName: claim.farm.orchardRegistration?.accountName,
          bankName: claim.farm.orchardRegistration?.bankName,
        },
        claimDetails: {
          diseaseType: claim.diseaseType,
          diseaseSeverity: claim.diseaseSeverity,
          ndviBaseline: claim.ndviBaseline,
          ndviCurrent: claim.ndviCurrent,
          ndviDropPercentage: claim.ndviDropPercentage,
        },
        trustEngine: {
          trustScore: claim.trustScore,
          componentScores: claim.componentScores,
        },
        status: claim.status,
        createdAt: claim.createdAt,
        latestAudit: claim.auditLogs[0],
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching pending claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/**
 * GET /api/admin/claims/:claimId/details
 * Get full details of a specific claim for review
 */
router.get('/claims/:claimId/details', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await prisma.claim.findUnique({
      where: { id: parseInt(claimId) },
      include: {
        farm: {
          include: {
            owner: true,
            orchardRegistration: true,
            ndviHistory: {
              orderBy: { fetchDate: 'desc' },
              take: 10,
            },
          },
        },
        policy: true,
        auditLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({
      id: claim.id,
      claimId: `CLM-${String(claim.id).padStart(6, '0')}`,
      farmerDetails: {
        id: claim.farm.owner.id,
        name: claim.farm.owner.farmerName,
        email: claim.farm.owner.email,
        phone: claim.farm.owner.phone,
        walletAddress: claim.farmerWalletAddress,
      },
      orchardDetails: {
        id: claim.farm.id,
        name: claim.farm.farmName,
        type: claim.farm.orchardType,
        address: claim.farm.fullAddress,
        areaAcres: claim.farm.areaAcres,
        numberOfTrees: claim.farm.numberOfTrees,
        treeTypes: claim.farm.treeTypes,
        accountNumber: claim.farm.orchardRegistration?.accountNumber,
        accountName: claim.farm.orchardRegistration?.accountName,
        bankName: claim.farm.orchardRegistration?.bankName,
        gpsPolygon: claim.farm.gpsPolygon,
      },
      claimDetails: {
        diseaseType: claim.diseaseType,
        diseaseSeverity: claim.diseaseSeverity,
        diseaseImageHash: claim.diseaseImageHash,
        ndviBaseline: claim.ndviBaseline,
        ndviCurrent: claim.ndviCurrent,
        ndviDropPercentage: claim.ndviDropPercentage,
        ndviVerified: claim.ndviVerified,
      },
      trustEngine: {
        trustScore: claim.trustScore,
        componentScores: claim.componentScores,
      },
      ipfsHashes: claim.ipfsHashes,
      status: claim.status,
      ndviHistory: claim.farm.ndviHistory.map((h) => ({
        date: h.fetchDate,
        value: h.ndviValue,
      })),
      auditTrail: claim.auditLogs.map((log) => ({
        action: log.action,
        trustScore: log.trustScore,
        componentScores: log.componentScores,
        imageIpfsHash: log.imageIpfsHash,
        ndviReportIpfsHash: log.ndviReportIpfsHash,
        thresholdReportIpfsHash: log.thresholdReportIpfsHash,
        approvedBy: log.approvedBy,
        remarks: log.remarks,
        createdAt: log.createdAt,
      })),
      createdAt: claim.createdAt,
      approvedAt: claim.approvedAt,
      txHash: claim.txHash,
    });
  } catch (error) {
    console.error('Error fetching claim details:', error);
    res.status(500).json({ error: 'Failed to fetch claim details' });
  }
});

/**
 * POST /api/admin/claims/:claimId/approve
 * Approve a claim
 */
router.post('/claims/:claimId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { remarks, amount } = req.body;
    const adminId = req.user.userId;

    const result = await approveClaimAndTriggerPayout({
      claimId: parseInt(claimId),
      adminId,
      remarks,
      amount,
    });

    res.json(result);
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to approve claim' });
  }
});

/**
 * POST /api/admin/claims/:claimId/reject
 * Reject a claim
 */
router.post('/claims/:claimId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { rejectionReason, remarks } = req.body;
    const adminId = req.user.userId;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const claim = await prisma.claim.findUnique({
      where: { id: parseInt(claimId) },
      include: { auditLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (!['PENDING', 'UNDER_REVIEW'].includes(claim.status)) {
      return res.status(400).json({ error: 'Claim cannot be rejected in current status' });
    }

    // Update claim status
    const updatedClaim = await prisma.claim.update({
      where: { id: parseInt(claimId) },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approvedBy: adminId,
        rejectionReason,
      },
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        claimId: parseInt(claimId),
        action: 'REJECTED',
        trustScore: claim.trustScore,
        componentScores: claim.componentScores,
        imageIpfsHash: claim.auditLogs[0]?.imageIpfsHash,
        ndviReportIpfsHash: claim.auditLogs[0]?.ndviReportIpfsHash,
        thresholdReportIpfsHash: claim.auditLogs[0]?.thresholdReportIpfsHash,
        approvedBy: adminId,
        remarks: remarks || rejectionReason,
      },
    });

    res.json({
      message: 'Claim rejected successfully',
      claim: updatedClaim,
    });
  } catch (error) {
    console.error('Error rejecting claim:', error);
    res.status(500).json({ error: 'Failed to reject claim' });
  }
});

/**
 * POST /api/admin/claims/:claimId/survey
 * Mark claim as pending survey
 */
router.post('/claims/:claimId/survey', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { remarks } = req.body;
    const adminId = req.user.userId;

    const claim = await prisma.claim.findUnique({
      where: { id: parseInt(claimId) },
      include: { auditLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    // Update claim status
    const updatedClaim = await prisma.claim.update({
      where: { id: parseInt(claimId) },
      data: {
        status: 'SURVEYED_PENDING',
        approvedBy: adminId,
      },
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        claimId: parseInt(claimId),
        action: 'SURVEYED_PENDING',
        trustScore: claim.trustScore,
        componentScores: claim.componentScores,
        imageIpfsHash: claim.auditLogs[0]?.imageIpfsHash,
        ndviReportIpfsHash: claim.auditLogs[0]?.ndviReportIpfsHash,
        thresholdReportIpfsHash: claim.auditLogs[0]?.thresholdReportIpfsHash,
        approvedBy: adminId,
        remarks: remarks || 'Claim marked for field survey',
      },
    });

    res.json({
      message: 'Claim marked for survey successfully',
      claim: updatedClaim,
    });
  } catch (error) {
    console.error('Error marking claim for survey:', error);
    res.status(500).json({ error: 'Failed to mark claim for survey' });
  }
});

/**
 * GET /api/admin/dashboard-stats
 * Get admin dashboard statistics
 */
router.get('/dashboard-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      totalClaims,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      surveyPendingClaims,
      averageTrustScore,
    ] = await Promise.all([
      prisma.claim.count(),
      prisma.claim.count({ where: { status: 'PENDING' } }),
      prisma.claim.count({ where: { status: 'APPROVED' } }),
      prisma.claim.count({ where: { status: 'REJECTED' } }),
      prisma.claim.count({ where: { status: 'SURVEYED_PENDING' } }),
      prisma.claim.aggregate({
        _avg: { trustScore: true },
        where: { trustScore: { not: null } },
      }),
    ]);

    res.json({
      stats: {
        totalClaims,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        surveyPendingClaims,
        averageTrustScore: averageTrustScore._avg.trustScore || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;
