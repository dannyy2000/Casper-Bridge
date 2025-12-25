const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc2.sepolia.org");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log("Address:", wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
