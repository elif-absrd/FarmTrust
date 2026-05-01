const { ethers } = require("ethers");
const path = require("path");

const POLYGON_NETWORK = (process.env.POLYGON_NETWORK || "mumbai").toLowerCase();
const RPC_URL =
  process.env.ALCHEMY_POLYGON_MUMBAI_RPC || process.env.ALCHEMY_POLYGON_AMOY_RPC;

const ABI_PATH_CANDIDATES = [
  path.join(
    __dirname,
    "..",
    "..",
    "web3",
    "web3",
    "artifacts",
    "contracts",
    "MockInsurance.sol",
    "MockInsurance.json"
  ),
  path.join(
    __dirname,
    "..",
    "web3",
    "artifacts",
    "contracts",
    "MockInsurance.sol",
    "MockInsurance.json"
  ),
];

let MockInsuranceABI = null;

function loadMockInsuranceAbi() {
  if (MockInsuranceABI) {
    return MockInsuranceABI;
  }

  for (const candidate of ABI_PATH_CANDIDATES) {
    try {
      MockInsuranceABI = require(candidate);
      return MockInsuranceABI;
    } catch (error) {
      // Try next candidate
    }
  }

  throw new Error("MockInsurance ABI not found. Compile contracts first.");
}

function getProvider() {
  if (!RPC_URL) {
    throw new Error("Missing Polygon RPC URL (ALCHEMY_POLYGON_MUMBAI_RPC or ALCHEMY_POLYGON_AMOY_RPC).");
  }
  return new ethers.JsonRpcProvider(RPC_URL);
}

function getWallet() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Missing PRIVATE_KEY for blockchain transactions.");
  }
  return new ethers.Wallet(process.env.PRIVATE_KEY, getProvider());
}

function getInsuranceContract() {
  if (!process.env.MOCK_INSURANCE_ADDRESS) {
    throw new Error("Missing MOCK_INSURANCE_ADDRESS.");
  }
  const abi = loadMockInsuranceAbi();
  return new ethers.Contract(
    process.env.MOCK_INSURANCE_ADDRESS,
    abi.abi,
    getWallet()
  );
}

function getPolygonscanBaseUrl() {
  if (POLYGON_NETWORK === "amoy") {
    return "https://amoy.polygonscan.com";
  }
  return "https://mumbai.polygonscan.com";
}

function getPolygonscanTxUrl(txHash) {
  return `${getPolygonscanBaseUrl()}/tx/${txHash}`;
}

async function triggerPayout(farmerAddr, amount, farmTokenId, claimId, ipfsHash) {
  const insurance = getInsuranceContract();
  const tx = await insurance.triggerPayout(
    farmerAddr,
    ethers.parseUnits(amount.toString(), 18),
    farmTokenId,
    claimId,
    ethers.encodeBytes32String(ipfsHash.slice(0, 31))
  );
  const receipt = await tx.wait();
  return receipt.hash; // tx_hash to store in PostgreSQL
}

module.exports = { triggerPayout, getPolygonscanTxUrl };
