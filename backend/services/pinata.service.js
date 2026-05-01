const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

const pinataAxios = axios.create({
  baseURL: 'https://api.pinata.cloud',
  headers: {
    pinata_api_key: PINATA_API_KEY,
    pinata_secret_api_key: PINATA_API_SECRET,
  },
});

/**
 * Upload a file to Pinata IPFS
 * @param {string} filePath - Path to the file to upload
 * @param {string} fileName - Name of the file
 * @returns {Promise<string>} - IPFS hash
 */
async function uploadFileToPinata(filePath, fileName) {
  try {
    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));

    const metadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        farmtrust: 'true',
        type: 'claim-document',
        timestamp: new Date().toISOString(),
      },
    });
    data.append('pinataMetadata', metadata);

    const response = await pinataAxios.post('/pinning/pinFileToIPFS', data, {
      headers: data.getHeaders(),
    });

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error.response?.data || error.message);
    throw new Error(`Failed to upload file to Pinata: ${error.message}`);
  }
}

/**
 * Upload JSON data to Pinata IPFS
 * @param {object} data - JSON data to upload
 * @param {string} name - Name for the JSON file
 * @returns {Promise<string>} - IPFS hash
 */
async function uploadJSONToPinata(data, name) {
  try {
    const payload = {
      pinataContent: data,
      pinataMetadata: {
        name: name,
        keyvalues: {
          farmtrust: 'true',
          type: 'claim-data',
          timestamp: new Date().toISOString(),
        },
      },
    };

    const response = await pinataAxios.post('/pinning/pinJSONToIPFS', payload);
    return response.data.IpfsHash;
  } catch (error) {
    console.error('Error uploading JSON to Pinata:', error.response?.data || error.message);
    throw new Error(`Failed to upload JSON to Pinata: ${error.message}`);
  }
}

/**
 * Upload multiple files related to a claim
 * @param {object} claimFiles - Object containing image, ndviReport, thresholdReport paths
 * @returns {Promise<object>} - Object with IPFS hashes for each file
 */
async function uploadClaimFiles(claimFiles) {
  try {
    const hashes = {};

    if (claimFiles.diseaseImage) {
      hashes.imageIpfsHash = await uploadFileToPinata(
        claimFiles.diseaseImage,
        `claim-disease-image-${Date.now()}.jpg`
      );
    }

    if (claimFiles.ndviReport) {
      hashes.ndviReportIpfsHash = await uploadFileToPinata(
        claimFiles.ndviReport,
        `claim-ndvi-report-${Date.now()}.pdf`
      );
    }

    if (claimFiles.thresholdReport) {
      hashes.thresholdReportIpfsHash = await uploadFileToPinata(
        claimFiles.thresholdReport,
        `claim-threshold-report-${Date.now()}.pdf`
      );
    }

    return hashes;
  } catch (error) {
    console.error('Error uploading claim files:', error.message);
    throw error;
  }
}

/**
 * Get IPFS file URL from gateway
 * @param {string} ipfsHash - IPFS hash
 * @returns {string} - Full IPFS gateway URL
 */
function getIPFSUrl(ipfsHash) {
  return `${PINATA_GATEWAY}/${ipfsHash}`;
}

/**
 * Fetch JSON (or text) content from IPFS by hash
 * @param {string} ipfsHash - IPFS hash
 * @returns {Promise<any>} - Parsed JSON or raw text
 */
async function fetchJsonFromIPFS(ipfsHash) {
  if (!ipfsHash) {
    return null;
  }

  const url = getIPFSUrl(ipfsHash);
  const response = await axios.get(url, {
    timeout: 10000,
    headers: { Accept: 'application/json,text/plain' },
  });

  if (typeof response.data === 'string') {
    try {
      return JSON.parse(response.data);
    } catch {
      return response.data;
    }
  }

  return response.data;
}

/**
 * Extract a numeric threshold from IPFS data payloads
 * @param {any} data - IPFS payload
 * @returns {number|null}
 */
function extractThreshold(data) {
  if (data === null || data === undefined) {
    return null;
  }

  const normalize = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (num > 1 && num <= 100) return num / 100;
    return num;
  };

  if (typeof data === 'number') {
    return normalize(data);
  }

  if (typeof data === 'string') {
    const direct = normalize(data);
    if (direct !== null) return direct;
    const match = data.match(/(?:0\.\d+|\d\.\d+|\d+)/);
    return match ? normalize(match[0]) : null;
  }

  if (typeof data === 'object') {
    const candidates = [
      data.threshold,
      data.Threshold,
      data.trustScore,
      data.trust_score,
      data.score,
      data.confidence,
    ];
    for (const candidate of candidates) {
      const normalized = normalize(candidate);
      if (normalized !== null) return normalized;
    }
  }

  return null;
}

/**
 * Verify IPFS hash availability
 * @param {string} ipfsHash - IPFS hash to verify
 * @returns {Promise<boolean>} - True if available
 */
async function verifyIPFSHash(ipfsHash) {
  try {
    const response = await axios.head(`${PINATA_GATEWAY}/${ipfsHash}`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    console.warn(`IPFS hash ${ipfsHash} not available:`, error.message);
    return false;
  }
}

module.exports = {
  uploadFileToPinata,
  uploadJSONToPinata,
  uploadClaimFiles,
  getIPFSUrl,
  fetchJsonFromIPFS,
  extractThreshold,
  verifyIPFSHash,
};
