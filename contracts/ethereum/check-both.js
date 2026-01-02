const { ethers } = require('hardhat');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const contract = new ethers.Contract(
    '0x08498FBFA0084394dF28555414F80a6C00814542',
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  console.log('Address currently connected: 0x02af...6f27');
  const balance1 = await contract.balanceOf('0x02af9c0487622d525454fad44d70bc7f90e26f27');
  console.log('wCSPR Balance:', ethers.formatEther(balance1), '\n');
  
  console.log('Address with 40 wCSPR: 0x58A8...172b');
  const balance2 = await contract.balanceOf('0x58A8D815eE6D1DDd027341650139B21c3258172b');
  console.log('wCSPR Balance:', ethers.formatEther(balance2));
}

main().catch(console.error);
