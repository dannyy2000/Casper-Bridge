const { ethers } = require('hardhat');

async function main() {
  console.log('🔥 Testing BURN function...\n');

  const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const contractAddress = '0x08498FBFA0084394dF28555414F80a6C00814542';

  // Use relayer private key (has 40 wCSPR)
  const relayerKey = '6f6f265d3edf1b59dc55fa0f3903758042922235f252190f35205e83482f6866';
  const wallet = new ethers.Wallet(relayerKey, provider);

  console.log(`Using wallet: ${wallet.address}`);

  // Read contract
  const contractJSON = require('./artifacts/contracts/CasperBridgeWrapper.sol/CasperBridgeWrapper.json');
  const contract = new ethers.Contract(contractAddress, contractJSON.abi, wallet);

  try {
    // Check balance
    const balance = await contract.balanceOf(wallet.address);
    console.log(`Current wCSPR balance: ${ethers.formatEther(balance)} wCSPR\n`);

    if (balance === 0n) {
      console.log('❌ No wCSPR to burn!');
      return;
    }

    // Try to burn 1 wCSPR
    console.log('Attempting to burn 1 wCSPR...');
    const burnAmount = ethers.parseEther('1');
    const casperRecipient = '0203d6e3fb62d186834f4574ded8c8fbd91b78c72e9bd434f65a35d9b1e26f0270'; // Your Casper address

    const tx = await contract.burn(
      burnAmount,
      'casper',
      casperRecipient,
      { gasLimit: 200000 }
    );

    console.log(`📝 Burn transaction submitted: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`✅ Burn successful! Block: ${receipt.blockNumber}`);
    console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

    // Check new balance
    const newBalance = await contract.balanceOf(wallet.address);
    console.log(`\nNew wCSPR balance: ${ethers.formatEther(newBalance)} wCSPR`);

  } catch (error) {
    console.log(`❌ Burn failed: ${error.message}`);
    if (error.reason) console.log(`Reason: ${error.reason}`);
    if (error.code) console.log(`Code: ${error.code}`);
  }
}

main().catch(console.error);
