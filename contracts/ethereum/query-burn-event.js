const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Querying for AssetBurned events...\n");

  const contractAddress = "0x08498FBFA0084394dF28555414F80a6C00814542";
  const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
  const contract = CasperBridgeWrapper.attach(contractAddress);

  // Query for burn events in the last 50 blocks (in 10-block chunks for Alchemy free tier)
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = currentBlock - 50;

  console.log(`Querying blocks ${fromBlock} to ${currentBlock}...`);

  const filter = contract.filters.AssetBurned();
  const allEvents = [];

  // Query in 10-block chunks (Alchemy free tier limit)
  for (let start = fromBlock; start <= currentBlock; start += 10) {
    const end = Math.min(start + 9, currentBlock);
    const events = await contract.queryFilter(filter, start, end);
    allEvents.push(...events);
  }

  const events = allEvents;

  console.log(`\nFound ${events.length} AssetBurned event(s):\n`);

  for (const event of events) {
    if ('args' in event && event.args) {
      console.log(`Event #${event.args.nonce}:`);
      console.log(`  User: ${event.args.user}`);
      console.log(`  Amount: ${ethers.formatUnits(event.args.amount, 9)} CSPR`);
      console.log(`  Destination Chain: ${event.args.destinationChain}`);
      console.log(`  Destination Address: ${event.args.destinationAddress}`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log(`  TX: ${event.transactionHash}`);
      console.log("");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
