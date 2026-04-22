const { ethers } = require('ethers');

function buildFallbackTokenId(farmId, userId) {
  return `LOCAL-${userId}-${farmId}-${Date.now()}`;
}

async function assignFarmIdentityOnPolygon({ farmId, userId, farmName }) {
  const rpcUrl = process.env.POLYGON_TESTNET_RPC_URL;
  const privateKey = process.env.POLYGON_TESTNET_PRIVATE_KEY;
  const contractAddress = process.env.FARM_IDENTITY_CONTRACT_ADDRESS;
  const networkName = process.env.POLYGON_TESTNET_NETWORK || 'polygon-amoy';

  if (!rpcUrl || !privateKey || !contractAddress) {
    return {
      farmTokenId: buildFallbackTokenId(farmId, userId),
      chainTxHash: null,
      chainNetwork: networkName,
      onChain: false,
    };
  }

  // Minimal ABI for minting farm identity NFT/token. Token id expected in Transfer event.
  const abi = [
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'function mintFarmIdentity(address to, string memory farmName, uint256 farmId) returns (uint256)',
  ];

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  const tx = await contract.mintFarmIdentity(wallet.address, farmName || `Farm-${farmId}`, BigInt(farmId));
  const receipt = await tx.wait();

  let tokenId = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === 'Transfer') {
        tokenId = parsed.args.tokenId.toString();
        break;
      }
    } catch {
      // Ignore logs from other contracts
    }
  }

  return {
    farmTokenId: tokenId || buildFallbackTokenId(farmId, userId),
    chainTxHash: receipt.hash,
    chainNetwork: networkName,
    onChain: Boolean(tokenId),
  };
}

module.exports = {
  assignFarmIdentityOnPolygon,
};
