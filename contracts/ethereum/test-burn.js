const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🔥 Testing Ethereum → Casper Bridge Flow (Burn & Release)");
  console.log("=".repeat(60));

  // Get the contract
  const contractAddress = "0x08498FBFA0084394dF28555414F80a6C00814542";
  const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
  const contract = CasperBridgeWrapper.attach(contractAddress);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`\n📍 Using account: ${signer.address}`);

  // Check balance
  const balance = await contract.balanceOf(signer.address);
  console.log(`💰 Current wrapped CSPR balance: ${ethers.formatUnits(balance, 9)} CSPR`);

  if (balance === 0n) {
    console.log("\n❌ Error: No wrapped CSPR tokens to burn!");
    console.log("💡 You need to mint some wrapped CSPR first or bridge from Casper to Ethereum");
    return;
  }

  // Burn parameters
  const burnAmount = ethers.parseUnits("1000000000", 9); // Burn 1 billion CSPR (minimum amount)
  const destinationChain = "casper";
  // Use your Casper account address - you'll need to update this
  const destinationAddress = "account-hash-0203d67680af8fe885ac24986a8c6b8c4cc6be1ef6e06a3cf22beedc557e91b80270";

  console.log("\n🔥 Burning wrapped CSPR...");
  console.log(`   Amount: ${ethers.formatUnits(burnAmount, 9)} CSPR`);
  console.log(`   Destination Chain: ${destinationChain}`);
  console.log(`   Destination Address: ${destinationAddress}`);

  // Send burn transaction
  const tx = await contract.burn(
    burnAmount,
    destinationChain,
    destinationAddress
  );

  console.log(`\n⏳ Transaction submitted: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();

  console.log(`\n✅ Transaction confirmed!`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

  // Find the AssetBurned event
  const burnEvent = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === "AssetBurned";
    } catch {
      return false;
    }
  });

  if (burnEvent) {
    const parsed = contract.interface.parseLog(burnEvent);
    console.log(`\n🎉 AssetBurned Event Emitted:`);
    console.log(`   User: ${parsed.args.user}`);
    console.log(`   Amount: ${ethers.formatUnits(parsed.args.amount, 9)} CSPR`);
    console.log(`   Destination Chain: ${parsed.args.destinationChain}`);
    console.log(`   Destination Address: ${parsed.args.destinationAddress}`);
    console.log(`   Nonce: ${parsed.args.nonce.toString()}`);
  }

  // Check new balance
  const newBalance = await contract.balanceOf(signer.address);
  console.log(`\n💰 New wrapped CSPR balance: ${ethers.formatUnits(newBalance, 9)} CSPR`);

  console.log("\n" + "=".repeat(60));
  console.log("👀 Now watch the relayer logs to see it detect this event!");
  console.log("   The relayer should submit a release proof to Casper");
  console.log("\n   Monitor with: tail -f /tmp/claude/-home-danielakinsanya/tasks/b5f6d06.output");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
