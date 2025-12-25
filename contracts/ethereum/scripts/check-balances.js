const hre = require("hardhat");

async function main() {
  const contract = await hre.ethers.getContractAt(
    "CasperBridgeWrapper",
    "0x08498FBFA0084394dF28555414F80a6C00814542"
  );

  const nonce = await contract.nonce();
  console.log("Current nonce:", nonce.toString());

  // Check balance of both addresses
  const bal1 = await contract.balanceOf("0x94ed4AE818008E0B2400e29b26FE569232b7647D");
  const bal2 = await contract.balanceOf("0x58A8D815eE6D1DDd027341650139B21c3258172b");

  console.log("\nDeployer (0x94ed...):", hre.ethers.formatEther(bal1), "wCSPR");
  console.log("Your address (0x58A8...):", hre.ethers.formatEther(bal2), "wCSPR");
}

main().catch(console.error);
