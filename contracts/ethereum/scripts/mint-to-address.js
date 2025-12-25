const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Mint test wCSPR tokens to a specific address
 */
async function main() {
  // Get recipient from command line or use default
  const recipient = process.env.RECIPIENT || "0x58A8D815eE6D1DDd027341650139B21c3258172b";
  const amount = process.env.AMOUNT || "100"; // Default 100 wCSPR

  console.log("🪙  Minting wCSPR tokens...");
  console.log("Recipient:", recipient);
  console.log("Amount:", amount, "wCSPR\n");

  const contractAddress = "0x08498FBFA0084394dF28555414F80a6C00814542";
  const [validator] = await ethers.getSigners();

  const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
  const contract = CasperBridgeWrapper.attach(contractAddress);

  // Use a high random nonce to avoid collisions
  const nonce = Math.floor(Math.random() * 1000000) + 1000;
  const amountWei = ethers.parseEther(amount);
  const sourceChain = "casper";
  // Use timestamp + random to ensure uniqueness
  const sourceTxHash = "mock-" + Date.now() + "-" + Math.random().toString(36).substring(7);

  // Create message hash
  const messageHash = ethers.solidityPackedKeccak256(
    ["string", "string", "uint256", "address", "uint256"],
    [sourceChain, sourceTxHash, amountWei, recipient, nonce]
  );

  // Sign
  const signature = await validator.signMessage(ethers.getBytes(messageHash));

  // Prepare proof
  const proof = {
    sourceChain,
    sourceTxHash,
    amount: amountWei,
    recipient,
    nonce,
    validatorSignatures: [signature],
  };

  console.log("🚀 Submitting mint transaction...");
  const tx = await contract.mint(proof);
  console.log("TX:", tx.hash);

  console.log("⏳ Waiting...");
  await tx.wait();

  console.log("\n✅ MINTED!");
  const balance = await contract.balanceOf(recipient);
  console.log("Balance:", ethers.formatEther(balance), "wCSPR");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
