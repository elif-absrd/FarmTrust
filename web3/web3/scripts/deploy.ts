import { ethers } from "hardhat";

async function main(): Promise<void> {
  // Deploy MockINR token
  const MockINR = await ethers.getContractFactory("MockINR");
  const token = await MockINR.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ MockINR deployed to:", tokenAddress);

  // Deploy MockInsurance with token address
  const MockInsurance = await ethers.getContractFactory("MockInsurance");
  const insurance = await MockInsurance.deploy(tokenAddress);
  await insurance.waitForDeployment();
  const insuranceAddress = await insurance.getAddress();
  console.log("✅ MockInsurance deployed to:", insuranceAddress);

  console.log("\n📋 Copy these to your backend .env:");
  console.log(`MOCK_INR_ADDRESS=${tokenAddress}`);
  console.log(`MOCK_INSURANCE_ADDRESS=${insuranceAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});