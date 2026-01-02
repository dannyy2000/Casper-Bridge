const { ethers } = require('ethers');

const key1 = '5a035bf47d76de499b73139899bea499345915029fa71e1b57902aaf1a41131c';
const key2 = '6f6f265d3edf1b59dc55fa0f3903758042922235f252190f35205e83482f6866';

const wallet1 = new ethers.Wallet(key1);
const wallet2 = new ethers.Wallet(key2);

console.log('Contract .env:', wallet1.address);
console.log('Relayer .env:', wallet2.address);
console.log('');
console.log('Contract owner (deployer):', '0x94ed4AE818008E0B2400e29b26FE569232b7647D');
console.log('');
console.log('Match:', wallet1.address === '0x94ed4AE818008E0B2400e29b26FE569232b7647D' ? 'Contract .env ✅' : 
                      wallet2.address === '0x94ed4AE818008E0B2400e29b26FE569232b7647D' ? 'Relayer .env ✅' : 'NEITHER ❌');
