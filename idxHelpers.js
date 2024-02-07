const bsv = require('bsv');
const sqlDB = require('./sqlDB');
const pool = sqlDB.pool(true);
const LOCKUP_PREFIX = `2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c`;
const sleep = timeout => { return new Promise(resolve => setTimeout(resolve, timeout)) }
const getValue = (arr, value, tx = false) => {
    if (tx) {
        const increment = value === 'context' || value === 'channel' || value === 'club' || value === 'tx' ? 2 : 1;
        const idx = arr.findIndex(a => a === value) + increment;
        return arr[idx];
    }
    const increment = value === 'context' || value === 'channel' || value === 'club' ? 2 : 1;
    const idx = arr.findIndex(a => a === value) + increment;
    return arr[idx];
}
const changeEndianness = string => {// change endianess of hex value before placing into ASM script
    const result = [];
    let len = string.length - 2;
    while (len >= 0) {
      result.push(string.substr(len, 2));
      len -= 2;
    }
    return result.join('');
}
const hex2Int = hex => {
    const reversedHex = changeEndianness(hex);
    return parseInt(reversedHex, 16);
}
const replaceAll = (str, find, replace) => { return str.replace(new RegExp(find, 'g'), replace) }
const idxTx = async(rawtx, blockHeight, blockIndex) => {
    try {
        const bsvtx = new bsv.Transaction(rawtx);
        const txid = bsvtx.hash;
        const lockOutput = bsvtx.outputs.find(output => output._scriptBuffer.toString('hex').includes(LOCKUP_PREFIX)
            && !output._scriptBuffer.toString('hex').includes('6f7264'));
        if (!lockOutput) return;
        const lockScript = bsv.Script(lockOutput._scriptBuffer);
        const hexAddr = lockScript?.chunks[5]?.buf.toString('hex');
        const script = bsv.Script.fromASM(`OP_DUP OP_HASH160 ${hexAddr} OP_EQUALVERIFY OP_CHECKSIG`);
        const address = bsv.Address.fromScript(script).toString();
        const hexBlock = lockScript?.chunks[6]?.buf.toString('hex');
        const lockBlock = hex2Int(hexBlock);
        const satoshis = lockOutput.satoshis;
        const blocksLocked = lockBlock - blockHeight;
        const txt = `${lockOutput.satoshis / 100000000} Bitcoin were just locked🔒 for ${blocksLocked} blocks⛏`
        console.log(txt);
        const op = bsvtx.outputs.find(x => x.satoshis === 0);
        if (op) {
            const arr = bsv.Script(op._scriptBuffer).toASM().split(' ');
            const strArr = arr.map(a => Buffer.from(a, 'hex').toString());
            const type = getValue(strArr, 'type');
            const app = getValue(strArr, 'app');
            const paymail = getValue(strArr, 'paymail');
            if (type === 'post') {
                const content = strArr[3];
                const flds = ['content', 'txid', 'address', 'app', 'paymail', 'satoshis', 'lockHeight', 'txBlockHeight', 'blockIndex'];
                const contentText = replaceAll(content, "'", "''");
                const vls = [contentText, txid, address, app, paymail, satoshis, lockBlock, blockHeight, blockIndex]
                const stmt = sqlDB.insert('locks', flds, vls, true);
                await sqlDB.sqlPromise(stmt, 'Failed to insert lock.', '', pool);
            }
            if (type === 'lock') {
                const jig = getValue(strArr, 'jig');
                const context = getValue(strArr, 'context');
                const flds = ['txid', 'app', 'address', 'satoshis', 'lockHeight', 'txBlockHeight', 'paymail', 'blockIndex'];
                const vls = [txid, app, address, satoshis, lockBlock, blockHeight, paymail, blockIndex]
                const stmt = sqlDB.insert('locks', flds, vls, true);
                await sqlDB.sqlPromise(stmt, 'Failed to insert lock.', '', pool);
                return;
            }
            if (type === 'like') {
                const likedTxid = getValue(strArr, 'tx');
                const flds = ['content', 'txid', 'app', 'address', 'satoshis', 'lockHeight', 'txBlockHeight', 'likedTxid', 'paymail', 'blockIndex'];
                const vls = ['', txid, app, address, satoshis, lockBlock, blockHeight, likedTxid, paymail, blockIndex]
                const stmt = sqlDB.insert('locks', flds, vls, true);
                await sqlDB.sqlPromise(stmt, 'Failed to insert lock.', '', pool);
                return;
            }
        } else {
            console.log(txid);
            const flds = ['txid', 'address', 'satoshis', 'lockHeight', 'txBlockHeight', 'blockIndex'];
            const vls = [txid, address, satoshis, lockBlock, blockHeight, blockIndex]
            const stmt = sqlDB.insert('locks', flds, vls, true);
            await sqlDB.sqlPromise(stmt, 'Failed to insert lock.', '', pool);
        }
        return;
    } catch(e) {
        console.log(e);
        return;
    }
}
exports.sleep = sleep;
exports.getValue = getValue;
exports.idxTx = idxTx;