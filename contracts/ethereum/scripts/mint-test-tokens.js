const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Mint test wCSPR tokens for testing the bridge
 * This simulates a successful lock on Casper Network
 */
async function main() {
  console.log("🪙  Minting test wCSPR tokens...\n");

  // Get contract address from env or use deployed address
  const contractAddress = "0x08498FBFA0084394dF28555414F80a6C00814542";

  // Get signer (validator/owner)
  const [validator] = await ethers.getSigners();
  console.log("Validator address:", validator.address);

  // Get contract instance
  const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
  const contract = CasperBridgeWrapper.attach(contractAddress);

  // Check current nonce
  const currentNonce = await contract.nonce();
  console.log("Current nonce:", currentNonce.toString());

  // Prepare mint proof
  const recipient = validator.address; // Mint to validator for testing
  const amount = ethers.parseEther("100"); // 100 wCSPR
  const nonce = Number(currentNonce) + 1; // Increment nonce
  const sourceChain = "casper";
  const sourceTxHash = "mock-casper-tx-" + Date.now();

  console.log("\n📝 Mint Details:");
  console.log("- Recipient:", recipient);
  console.log("- Amount:", ethers.formatEther(amount), "wCSPR");
  console.log("- Nonce:", nonce);
  console.log("- Source Chain:", sourceChain);
  console.log("- Source TX:", sourceTxHash);

  // Create message hash (must match contract's _getMessageHash)
  // Contract uses abi.encodePacked, so we use solidityPackedKeccak256
  const messageHash = ethers.solidityPackedKeccak256(
    ["string", "string", "uint256", "address", "uint256"],
    [sourceChain, sourceTxHash, amount, recipient, nonce]
  );

  console.log("\n🔐 Signing proof...");
  console.log("Message hash:", messageHash);

  // Sign the message (validator signature)
  const signature = await validator.signMessage(ethers.getBytes(messageHash));
  console.log("Signature:", signature);

  // Prepare proof struct
  const proof = {
    sourceChain,
    sourceTxHash,
    amount,
    recipient,
    nonce,
    validatorSignatures: [signature],
  };

  console.log("\n🚀 Submitting mint transaction...");

  // Call mint function
  const tx = await contract.mint(proof);
  console.log("Transaction sent:", tx.hash);

  console.log("⏳ Waiting for confirmation...");
  const receipt = await tx.wait();

  console.log("\n✅ MINT SUCCESSFUL!");
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());

  // Check balance
  const balance = await contract.balanceOf(recipient);
  console.log("\n💰 New wCSPR Balance:", ethers.formatEther(balance), "wCSPR");

  // Check total bridged
  const totalBridged = await contract.totalBridged();
  console.log("Total Bridged:", ethers.formatEther(totalBridged), "wCSPR");

  console.log("\n🎉 You can now test burning these tokens in the frontend!");
  console.log("Frontend URL: http://localhost:5173 (after running npm run dev)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
