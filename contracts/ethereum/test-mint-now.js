const { ethers } = require('hardhat');

async function main() {
  console.log('🔍 Testing what actually works...\n');

  const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const contractAddress = '0x08498FBFA0084394dF28555414F80a6C00814542';

  // Read contract ABI
  const contractJSON = require('./artifacts/contracts/CasperBridgeWrapper.sol/CasperBridgeWrapper.json');

  console.log('1️⃣ Testing READ functions (should work)...');
  const contract = new ethers.Contract(contractAddress, contractJSON.abi, provider);

  try {
    const name = await contract.name();
    const symbol = await contract.symbol();
    const totalSupply = await contract.totalSupply();
    console.log('✅ Contract is accessible!');
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} wCSPR\n`);
  } catch (error) {
    console.log('❌ Cannot read from contract:', error.message);
    return;
  }

  console.log('2️⃣ Testing WRITE functions (mint)...');

  // Load private key from .env
  require('dotenv').config();
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contractWithSigner = contract.connect(wallet);

  console.log(`   Using wallet: ${wallet.address}`);

  try {
    // Check if this wallet is the owner
    const owner = await contract.owner();
    console.log(`   Contract owner: ${owner}`);
    console.log(`   Are we owner? ${owner.toLowerCase() === wallet.address.toLowerCase()}\n`);

    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log('❌ Wallet is NOT the owner - cannot mint!');
      return;
    }

    // Try to mint 1 wCSPR to test
    console.log('   Attempting to mint 1 wCSPR to test...');
    const recipient = '0x58A8D815eE6D1DDd027341650139B21c3258172b';
    const amount = ethers.parseEther('1');
    const nonce = Math.floor(Math.random() * 1000000);

    // Create dummy validator signature
    const message = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'address', 'uint256'],
      ['casper', '0x0', amount.toString(), recipient, nonce]
    );

    const signature = await wallet.signMessage(ethers.getBytes(message));

    const tx = await contractWithSigner.mint(
      'casper',
      '0x0',
      amount,
      recipient,
      nonce,
      [signature],
      { gasLimit: 300000 }
    );

    console.log(`   📝 Transaction submitted: ${tx.hash}`);
    console.log(`   ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`   ✅ Mint successful! Block: ${receipt.blockNumber}`);

  } catch (error) {
    console.log(`   ❌ Mint failed: ${error.message}`);
    if (error.reason) console.log(`   Reason: ${error.reason}`);
  }
}

main().catch(console.error);
