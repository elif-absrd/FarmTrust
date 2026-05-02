const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto");

/**
 * Generate a deterministic local placeholder IPFS hash.
 * Used as a dev/testing fallback when Pinata is unavailable or returns 401.
 */
function localIpfsPlaceholder(seed) {
  return "local-ipfs-" + crypto.createHash("sha256").update(String(seed) + Date.now()).digest("hex");
}

// Upload JSON to IPFS via Pinata (falls back to a local placeholder on failure)
async function uploadJSONToIPFS(jsonData) {
  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        pinataContent: jsonData,
        pinataMetadata: {
          name: `farmtrust-claim-${Date.now()}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Pinata upload success:", response.data.IpfsHash);
    return response.data.IpfsHash;
  } catch (error) {
    const reason = error?.response?.data?.error?.details
      || error?.response?.data?.error
      || error?.response?.statusText
      || error?.message
      || "unknown";
    console.warn(`⚠️  Pinata JSON upload failed (${reason}); using local placeholder hash.`);
    return localIpfsPlaceholder(JSON.stringify(jsonData));
  }
}

// Upload file buffer to IPFS via Pinata (falls back to a local placeholder on failure)
async function uploadToIPFS(fileBuffer, fileName) {
  try {
    const formData = new FormData();
    formData.append("file", fileBuffer, fileName);
    formData.append("pinataMetadata", JSON.stringify({ name: fileName }));

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    );
    console.log("✅ Pinata file upload success:", response.data.IpfsHash);
    return response.data.IpfsHash;
  } catch (error) {
    const reason = error?.response?.data?.error?.details
      || error?.response?.data?.error
      || error?.response?.statusText
      || error?.message
      || "unknown";
    console.warn(`⚠️  Pinata file upload failed (${reason}); using local placeholder hash.`);
    return localIpfsPlaceholder(fileName || "file");
  }
}

module.exports = { uploadToIPFS, uploadJSONToIPFS };