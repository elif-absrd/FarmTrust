const express = require('express');
const RiskAssessmentService = require('../riskScoringEngine/service');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const { uploadClaimFiles, uploadJSONToPinata } = require('../services/pinata.service');

// Configuration
const NDVI_SERVICE_URL = process.env.NDVI_SERVICE_URL || 'http://localhost:8000';

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
      include: {
        farm: {
          select: {
            id: true,
            farmName: true,
            cropType: true,
            orchardType: true,
          },
        },
        policy: {
          select: {
            coverageAmount: true,
          },
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
// Get audit trail for a claim
router.get('/:claimId/audit-trail', authenticateToken, async (req, res) => {
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
      include: {
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const auditTrail = [];
    auditTrail.push({
      step: 'Claim Filed',
      time: claim.createdAt,
      detail: `Claim submitted for farm ${claim.farmId}`,
    });

    const actionLabels = {
      TRUST_ENGINE_PROCESSED: 'Trust Engine Processed',
      PAYOUT_TRIGGERED: 'Payout Triggered',
      PAYMENT_FINALIZED: 'Payment Finalized',
      REJECTED: 'Claim Rejected',
      ESCALATED: 'Escalated for Review',
      SURVEYED_PENDING: 'Survey Required',
      SURVEY_APPROVED: 'Survey Approved',
      SURVEY_REJECTED: 'Survey Rejected',
    };

    claim.auditLogs.forEach((log) => {
      auditTrail.push({
        step: actionLabels[log.action] || log.action,
        time: log.createdAt,
        detail: log.remarks || null,
      });
    });

    const hasDecisionLog = claim.auditLogs.some((log) =>
      ['REJECTED', 'SURVEYED_PENDING', 'PAYOUT_TRIGGERED', 'PAYMENT_FINALIZED', 'ESCALATED'].includes(log.action),
    );

    if (!hasDecisionLog && claim.approvedAt) {
      let decisionLabel = 'Decision Recorded';
      if (claim.status === 'APPROVED') decisionLabel = 'Claim Approved';
      if (claim.status === 'UNDER_REVIEW') decisionLabel = 'Under Review';
      if (claim.status === 'PAID') decisionLabel = 'Payout Complete';
      if (claim.status === 'REJECTED') decisionLabel = 'Claim Rejected';
      if (claim.status === 'SURVEYED_PENDING') decisionLabel = 'Survey Required';

      auditTrail.push({
        step: decisionLabel,
        time: claim.approvedAt,
        detail: claim.rejectionReason || null,
      });
    }

    if (claim.status === 'PAID' && claim.txHash) {
      auditTrail.push({
        step: 'Payout Complete',
        time: claim.updatedAt,
        detail: `Transaction hash ${claim.txHash}`,
      });
    }

    res.json({
      claimId: claim.id,
      status: claim.status,
      auditTrail,
    });
  } catch (error) {
    console.error('Fetch audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
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

    res.json({ claim });
  } catch (error) {
    console.error('Fetch claim error:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

/**
 * POST /api/claims/:claimId/trust-engine-results
 * Process trust engine results and upload files to IPFS
 */
router.post('/:claimId/trust-engine-results', authenticateToken, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { trustScore, componentScores, diseaseImagePath, ndviReportPath, thresholdReportPath } = req.body;
    const userId = req.user.userId;

    // Verify claim exists and belongs to user
    const claim = await prisma.claim.findFirst({
      where: {
        id: parseInt(claimId),
        farm: {
          ownerId: userId,
        },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (!trustScore || !componentScores) {
      return res.status(400).json({ error: 'Trust score and component scores are required' });
    }

    try {
      // Upload files to IPFS
      const claimFiles = {};
      const ipfsHashes = {};

      if (diseaseImagePath && fs.existsSync(diseaseImagePath)) {
        claimFiles.diseaseImage = diseaseImagePath;
      }
      if (ndviReportPath && fs.existsSync(ndviReportPath)) {
        claimFiles.ndviReport = ndviReportPath;
      }
      if (thresholdReportPath && fs.existsSync(thresholdReportPath)) {
        claimFiles.thresholdReport = thresholdReportPath;
      }

      // Upload to IPFS if files exist
      if (Object.keys(claimFiles).length > 0) {
        const hashes = await uploadClaimFiles(claimFiles);
        Object.assign(ipfsHashes, hashes);
      }

      // Update claim with trust engine results and IPFS hashes
      const updatedClaim = await prisma.claim.update({
        where: { id: parseInt(claimId) },
        data: {
          trustScore: parseFloat(trustScore),
          componentScores: componentScores,
          ipfsHashes: ipfsHashes,
          status: 'PENDING',
        },
      });

      // Create audit log entry with IPFS hashes and trust scores
      await prisma.auditLog.create({
        data: {
          claimId: parseInt(claimId),
          action: 'TRUST_ENGINE_PROCESSED',
          imageIpfsHash: ipfsHashes.imageIpfsHash || null,
          ndviReportIpfsHash: ipfsHashes.ndviReportIpfsHash || null,
          thresholdReportIpfsHash: ipfsHashes.thresholdReportIpfsHash || null,
          trustScore: parseFloat(trustScore),
          componentScores: componentScores,
          remarks: 'Trust engine processed and files uploaded to IPFS',
        },
      });

      res.json({
        message: 'Trust engine results processed and uploaded to IPFS',
        claim: updatedClaim,
        ipfsHashes,
      });
    } catch (ipfsError) {
      console.error('IPFS upload error:', ipfsError);
      
      // Still update claim with trust scores even if IPFS upload fails
      const updatedClaim = await prisma.claim.update({
        where: { id: parseInt(claimId) },
        data: {
          trustScore: parseFloat(trustScore),
          componentScores: componentScores,
          status: 'PENDING',
        },
      });

      res.status(207).json({
        message: 'Trust engine results saved (IPFS upload failed)',
        claim: updatedClaim,
        warning: ipfsError.message,
      });
    }
  } catch (error) {
    console.error('Trust engine processing error:', error);
    res.status(500).json({ error: 'Failed to process trust engine results' });
  }
});

/**
 * POST /api/claims/:claimId/finalize-payment
 * Finalize payment after admin approval and write tx_hash to blockchain
 */
router.post('/:claimId/finalize-payment', authenticateToken, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { txHash, threshold } = req.body;
    const userId = req.user.userId;

    // Verify claim exists and belongs to user
    const claim = await prisma.claim.findFirst({
      where: {
        id: parseInt(claimId),
        farm: {
          ownerId: userId,
        },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Claim must be approved before finalization' });
    }

    // Update claim with tx hash
    const updatedClaim = await prisma.claim.update({
      where: { id: parseInt(claimId) },
      data: {
        txHash: txHash,
        status: 'PAID',
      },
    });

    // Create immutable record on blockchain
    // This should be called separately from the blockchain service
    // For now, we just store the record
    await prisma.auditLog.create({
      data: {
        claimId: parseInt(claimId),
        action: 'PAYMENT_FINALIZED',
        remarks: `Immutable record: farmId=${claim.farmId}, claimId=${claimId}, threshold=${threshold}, txHash=${txHash}`,
      },
    });

    res.json({
      message: 'Payment finalized successfully',
      claim: updatedClaim,
    });
  } catch (error) {
    console.error('Payment finalization error:', error);
    res.status(500).json({ error: 'Failed to finalize payment' });
  }
});

module.exports = router;
