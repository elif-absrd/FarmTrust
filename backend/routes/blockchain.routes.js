const express = require('express');
const { getPolygonscanTxUrl } = require('../services/blockchain.service');

const router = express.Router();

// GET /api/blockchain/tx-status/:txHash
router.get('/tx-status/:txHash', (req, res) => {
  const { txHash } = req.params;
  res.json({ polygonscanUrl: getPolygonscanTxUrl(txHash) });
});

module.exports = router;
