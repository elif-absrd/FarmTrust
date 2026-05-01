const  PinataSDK = require("@pinata/sdk");
const pinata = new PinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_SECRET_KEY
);

async function uploadToIPFS(fileBuffer, fileName) {
  const result = await pinata.pinFileToIPFS(fileBuffer, {
    pinataMetadata: { name: fileName },
  });
  return result.IpfsHash; // returns the IPFS hash (CID)
}

async function uploadJSONToIPFS(jsonData) {
  const result = await pinata.pinJSONToIPFS(jsonData);
  return result.IpfsHash;
}

module.exports = { uploadToIPFS, uploadJSONToIPFS };