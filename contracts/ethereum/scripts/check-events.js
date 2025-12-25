const hre = require("hardhat");

async function main() {
  const address = "0x58A8D815eE6D1DDd027341650139B21c3258172b";

  const contract = await hre.ethers.getContractAt(
    "CasperBridgeWrapper",
    "0x08498FBFA0084394dF28555414F80a6C00814542"
  );

  console.log("Checking events for:", address);
  console.log("");

  // Check current balance
  const balance = await contract.balanceOf(address);
  console.log("Current wCSPR balance:", hre.ethers.formatEther(balance));

  // Get current block
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log("Current block:", currentBlock);

  // Check for AssetBurned events
  console.log("\n🔥 Checking AssetBurned events...");
  const burnFilter = contract.filters.AssetBurned(address);
  const burnEvents = await contract.queryFilter(burnFilter, currentBlock - 1000, currentBlock);

  console.log("Found", burnEvents.length, "burn events");
  burnEvents.forEach((event, i) => {
    console.log(`\nBurn ${i + 1}:`);
    console.log("  TX:", event.transactionHash);
    console.log("  Block:", event.blockNumber);
    console.log("  Amount:", hre.ethers.formatEther(event.args.amount));
    console.log("  Destination:", event.args.destinationAddress);
  });

  // Check for AssetMinted events
  console.log("\n💰 Checking AssetMinted events...");
  const mintFilter = contract.filters.AssetMinted(address);
  const mintEvents = await contract.queryFilter(mintFilter, currentBlock - 1000, currentBlock);

  console.log("Found", mintEvents.length, "mint events");
  mintEvents.forEach((event, i) => {
    console.log(`\nMint ${i + 1}:`);
    console.log("  TX:", event.transactionHash);
    console.log("  Block:", event.blockNumber);
    console.log("  Amount:", hre.ethers.formatEther(event.args.amount));
  });

  // Check ALL events (no filter)
  console.log("\n📊 Checking ALL events from contract...");
  const allEvents = await contract.queryFilter("*", currentBlock - 100, currentBlock);
  console.log("Found", allEvents.length, "total events in last 100 blocks");
}

main().catch(console.error);
