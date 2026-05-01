// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockINR.sol";

contract MockInsurance is Ownable {
    MockINR public token;

    struct Claim {
        uint256 farmId;
        uint256 claimId;
        uint256 timestamp;
        bytes32 txHash;
        bool paid;
    }

    mapping(uint256 => Claim) public claims;

    event PayoutTriggered(
        address indexed farmer,
        uint256 amount,
        uint256 farmTokenId,
        uint256 claimId,
        bytes32 ipfsHash
    );

    constructor(address _token) Ownable(msg.sender) {
        token = MockINR(_token);
    }

    function triggerPayout(
        address farmerAddr,
        uint256 amount,
        uint256 farmTokenId,
        uint256 claimId,
        bytes32 ipfsHash
    ) external onlyOwner {
        require(!claims[claimId].paid, "Already paid");
        token.transfer(farmerAddr, amount);
        claims[claimId] = Claim(farmTokenId, claimId, block.timestamp, ipfsHash, true);
        emit PayoutTriggered(farmerAddr, amount, farmTokenId, claimId, ipfsHash);
    }
}