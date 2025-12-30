const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🪙 Testing Casper → Ethereum Bridge Flow (Mint)");
  console.log("=".repeat(60));

  // Get the contract
  const contractAddress = "0x08498FBFA0084394dF28555414F80a6C00814542";
  const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
  const contract = CasperBridgeWrapper.attach(contractAddress);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`\n📍 Using account: ${signer.address}`);

  // Check initial balance
  const initialBalance = await contract.balanceOf(signer.address);
  console.log(`💰 Initial wrapped CSPR balance: ${ethers.formatUnits(initialBalance, 9)} CSPR`);

  // Mint proof parameters (simulating a lock event from Casper)
  const proof = {
    sourceChain: "casper",
    sourceTxHash: "test-casper-tx-hash-" + Date.now(), // Simulated Casper TX hash
    amount: ethers.parseUnits("2000000000", 9), // 2 billion CSPR (above minimum)
    recipient: signer.address,
    nonce: Math.floor(Date.now() / 1000), // Unique nonce
    validatorSignatures: []
  };

  console.log("\n🔐 Creating validator signature...");

  // Create message hash (must match contract's _getMessageHash)
  const messageHash = ethers.solidityPackedKeccak256(
    ['string', 'string', 'uint256', 'address', 'uint256'],
    [proof.sourceChain, proof.sourceTxHash, proof.amount, proof.recipient, proof.nonce]
  );

  console.log(`   Message hash: ${messageHash}`);

  // Sign the message
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  proof.validatorSignatures.push(signature);

  console.log(`   Signature: ${signature}`);
  console.log(`   Validator: ${signer.address}`);

  console.log("\n🪙 Minting wrapped CSPR...");
  console.log(`   Amount: ${ethers.formatUnits(proof.amount, 9)} CSPR`);
  console.log(`   Source Chain: ${proof.sourceChain}`);
  console.log(`   Source TX: ${proof.sourceTxHash}`);
  console.log(`   Recipient: ${proof.recipient}`);
  console.log(`   Nonce: ${proof.nonce}`);

  // Send mint transaction
  const tx = await contract.mint(proof);

  console.log(`\n⏳ Transaction submitted: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();

  console.log(`\n✅ Transaction confirmed!`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

  // Find the AssetMinted event
  const mintEvent = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === "AssetMinted";
    } catch {
      return false;
    }
  });

  if (mintEvent) {
    const parsed = contract.interface.parseLog(mintEvent);
    console.log(`\n🎉 AssetMinted Event Emitted:`);
    console.log(`   User: ${parsed.args.user}`);
    console.log(`   Amount: ${ethers.formatUnits(parsed.args.amount, 9)} CSPR`);
    console.log(`   Source Chain: ${parsed.args.sourceChain}`);
    console.log(`   Source TX: ${parsed.args.sourceTxHash}`);
    console.log(`   Nonce: ${parsed.args.nonce.toString()}`);
  }

  // Check new balance
  const newBalance = await contract.balanceOf(signer.address);
  console.log(`\n💰 New wrapped CSPR balance: ${ethers.formatUnits(newBalance, 9)} CSPR`);
  console.log(`   Increase: +${ethers.formatUnits(newBalance - initialBalance, 9)} CSPR`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Mint test completed successfully!");
  console.log("   This simulates the Casper → Ethereum bridge flow");
  console.log("   In production, the relayer would create this proof from a Casper lock event");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
