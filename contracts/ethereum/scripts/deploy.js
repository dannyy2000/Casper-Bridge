const hre = require("hardhat");

async function main() {
  console.log("Deploying CasperBridgeWrapper...");

  // Get deployment parameters
  const requiredSignatures = process.env.REQUIRED_SIGNATURES || 2;
  const minBurnAmount = process.env.MIN_BURN_AMOUNT || hre.ethers.parseEther("1");

  console.log("Parameters:");
  console.log("- Required Signatures:", requiredSignatures);
  console.log("- Min Burn Amount:", hre.ethers.formatEther(minBurnAmount), "wCSPR");

  // Deploy contract
  const CasperBridgeWrapper = await hre.ethers.getContractFactory("CasperBridgeWrapper");
  const wrapper = await CasperBridgeWrapper.deploy(requiredSignatures, minBurnAmount);

  await wrapper.waitForDeployment();

  const address = await wrapper.getAddress();
  console.log("\nCasperBridgeWrapper deployed to:", address);

  // Get deployer info
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployed by:", deployer.address);

  // Verify contract info
  const info = await wrapper.getInfo();
  console.log("\nContract Info:");
  console.log("- Nonce:", info[0].toString());
  console.log("- Total Bridged:", hre.ethers.formatEther(info[1]), "wCSPR");
  console.log("- Validator Count:", info[2].toString());

  console.log("\n✅ Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Save contract address to your .env file");
  console.log("2. Add additional validators if needed");
  console.log("3. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${address} ${requiredSignatures} ${minBurnAmount}`);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
