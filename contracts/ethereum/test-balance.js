const { ethers } = require('hardhat');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const contract = new ethers.Contract(
    '0x08498FBFA0084394dF28555414F80a6C00814542',
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  const balance = await contract.balanceOf('0x02af9c0487622d525454fad44d70bc7f90e26f27');
  console.log('wCSPR Balance:', ethers.formatEther(balance));
}

main().catch(console.error);
