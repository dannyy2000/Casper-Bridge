const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x08498FBFA0084394dF28555414F80a6C00814542";
  const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
  const contract = CasperBridgeWrapper.attach(contractAddress);

  const minBurnAmount = await contract.minBurnAmount();
  console.log(`Minimum burn amount: ${minBurnAmount.toString()} wei`);
  console.log(`Minimum burn amount: ${ethers.formatUnits(minBurnAmount, 9)} CSPR`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
