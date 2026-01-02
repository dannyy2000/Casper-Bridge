const { CasperClient } = require('casper-js-sdk');

const client = new CasperClient('http://34.220.83.153:7777/rpc');
const deployHash = 'efe79a35cbf9c952aa6317b072026c47d3e7343117b2c881abf2401ff04b8424';

async function check() {
    try {
        console.log('Fetching deploy...');
        const [deploy, deployResult] = await client.getDeploy(deployHash);
        console.log('Deploy result keys:', Object.keys(deployResult));
        console.log('Execution results:', JSON.stringify(deployResult.execution_results, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
