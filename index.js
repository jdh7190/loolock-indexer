const { JungleBusClient, ControlMessageStatusCode } = require('@gorillapool/js-junglebus');
const fetch = require('node-fetch');
require('dotenv').config();
const { idxTx } = require('./idxHelpers');
const API_URL = process.env.API_URL || 'http://localhost:9007';
const server = "junglebus.gorillapool.io";
const MAP_SUBSCRIPTION_ID = process.env.MAP_SUBSCRIPTION;
const LOCKUP_PREFIX = `2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c`;
const updateCrawl = async(height, hash) => {
    const r = await fetch(`${API_URL}/lockcrawl`, {
        method: 'post',
        body: JSON.stringify({ height, hash })
    })
    const res = await r.text();
    console.log(res);
    return res;
}
const client = new JungleBusClient(server, {
    useSSL: true,
    debug: false,
    onConnected(ctx) { console.log("CONNECTED", ctx) },
    onConnecting(ctx) { console.log("CONNECTING", ctx) },
    onDisconnected(ctx) { console.log("DISCONNECTED", ctx) },
    onError(ctx) { console.error(ctx) },
});
const onPublish = async function(tx) {
    try {
        if (tx.transaction.includes(LOCKUP_PREFIX)) {
            await idxTx(tx.transaction, tx.block_height, tx.block_time);
        }
    } catch(e) { console.log(`Issue with txid ${tx.id}`, e) }
}
const onStatus = function(message) {
    if (message.statusCode === ControlMessageStatusCode.BLOCK_DONE) {
      console.log("BLOCK DONE", message.block);
      updateCrawl(message.block, message.block_hash);
    } else if (message.statusCode === ControlMessageStatusCode.WAITING) {
      console.log("WAITING FOR NEW BLOCK...");
    } else if (message.statusCode === ControlMessageStatusCode.REORG) {
      console.log("REORG TRIGGERED", message);
    } else if (message.statusCode === ControlMessageStatusCode.ERROR) {
      console.error(message);
    }
}
const onError = function(err) { console.error(err) }
const onMempool = async function(tx) {}
const main = async() => {
    try {
        const b = await fetch(`${API_URL}/lockcrawl`);
        const bres = await b.json();
        const fromBlock = bres?.height || parseInt(process.env.BLOCK_HEIGHT);
        console.log(`FROM BLOCK: ${fromBlock}`);
        await client.Subscribe(MAP_SUBSCRIPTION_ID, fromBlock, onPublish, onStatus, onError, onMempool);
    } catch(e) {
        console.log({e})
    }
}
main()