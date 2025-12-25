const hre = require("hardhat");

async function main() {
  console.log("=== SEPOLIA CONNECTION DIAGNOSTIC ===\n");
  console.log("RPC URL:", hre.network.config.url);

  try {
    const provider = hre.ethers.provider;
    console.log("\n1. Checking network connection...");
    const network = await provider.getNetwork();
    console.log("   ✓ Connected to chain ID:", network.chainId.toString());

    console.log("\n2. Checking deployer account...");
    const [deployer] = await hre.ethers.getSigners();
    console.log("   Address:", deployer.address);

    console.log("\n3. Checking balance...");
    const balance = await provider.getBalance(deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
      console.log("\n❌ ISSUE: NO SEPOLIA ETH!");
      console.log("   You need test ETH from a faucet:");
      console.log("   - https://sepoliafaucet.com/");
      console.log("   - https://www.alchemy.com/faucets/ethereum-sepolia");
    } else {
      console.log("\n✅ Account has sufficient funds for deployment!");
    }

    console.log("\n4. Checking current gas price...");
    const feeData = await provider.getFeeData();
    console.log("   Gas Price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");

  } catch (error) {
    console.log("\n❌ CONNECTION FAILED!");
    console.log("Error Type:", error.code || error.name);
    console.log("Error Message:", error.message);
    console.log("\n💡 DIAGNOSIS:");
    console.log("   This is a NETWORK CONNECTIVITY issue.");
    console.log("   The RPC endpoint is not reachable from this environment.");
    console.log("   Possible causes:");
    console.log("   - Firewall blocking outbound connections");
    console.log("   - RPC endpoint is down or rate-limiting");
    console.log("   - Network routing issues");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
