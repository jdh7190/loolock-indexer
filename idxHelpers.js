const bsv = require('bsv');
const sqlDB = require('./sqlDB');
const pool = sqlDB.pool(true);
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
const idxTx = async(rawtx, blockHeight, blockTime) => {
    try {
        const bsvtx = new bsv.Transaction(rawtx);
        const op = bsvtx.outputs.find(x => x.satoshis === 0);
        if (!op) { rawtx = ''; return }
        console.log(bsvtx.hash)
        const arr = bsv.Script(op._scriptBuffer).toASM().split(' ');
        const strArr = arr.map(a => Buffer.from(a, 'hex').toString());
        const type = getValue(strArr, 'type');
        const app = getValue(strArr, 'app');
        const paymail = getValue(strArr, 'paymail');
        if (type === 'post') {
            const txid = bsvtx.hash;
            const hexAddr = bsvtx.outputs[0].script?.chunks[5]?.buf.toString('hex');
            const script = bsv.Script.fromASM(`OP_DUP OP_HASH160 ${hexAddr} OP_EQUALVERIFY OP_CHECKSIG`);
            const address = bsv.Address.fromScript(script).toString();
            const hexBlock = bsvtx.outputs[0].script?.chunks[6]?.buf.toString('hex');
            const lockBlock = hex2Int(hexBlock);
            const satoshis = bsvtx.outputs[0].satoshis;
            const blocksLocked = lockBlock - blockHeight;
            const txt = `${bsvtx.outputs[0].satoshis / 100000000} Bitcoin were just locked🔒 for ${blocksLocked} blocks⛏`
            console.log(txt)
            const content = strArr[3];
            const contentText = replaceAll(content, "'", "''");
            const replyTxid = getValue(strArr, 'tx', true);
            if (replyTxid.length === 64) {
                const flds = ['content', 'txid', 'contextTx', 'address', 'app', 'paymail', 'satoshis', 'lockHeight', 'txBlockHeight'];
                const vls = [contentText, txid, replyTxid, address, app, paymail, satoshis, lockBlock, blockHeight]
                const stmt = sqlDB.insert('locks', flds, vls, true);
                await sqlDB.sqlPromise(stmt, 'Failed to insert reply to lock post.', '', pool);
            } else {
                const flds = ['content', 'txid', 'address', 'app', 'paymail', 'satoshis', 'lockHeight', 'txBlockHeight'];
                const vls = [contentText, txid, address, app, paymail, satoshis, lockBlock, blockHeight]
                const stmt = sqlDB.insert('locks', flds, vls, true);
                await sqlDB.sqlPromise(stmt, 'Failed to insert lock post.', '', pool);
            }
        }
        if (type === 'like') {
            const likedTxid = getValue(strArr, 'tx');
            const txid = bsvtx.hash;
            const hexAddr = bsvtx.outputs[0].script?.chunks[5]?.buf.toString('hex');
            const script = bsv.Script.fromASM(`OP_DUP OP_HASH160 ${hexAddr} OP_EQUALVERIFY OP_CHECKSIG`);
            const address = bsv.Address.fromScript(script).toString();
            const hexBlock = bsvtx.outputs[0].script?.chunks[6]?.buf.toString('hex');
            const lockBlock = hex2Int(hexBlock);
            const satoshis = bsvtx.outputs[0].satoshis;
            const txt = `${bsvtx.outputs[0].satoshis / 100000000} $BSV were just locked🔒 for ${lockBlock - blockHeight} blocks!`
            console.log(txt)
            const flds = ['likedTxid', 'txid', 'app', 'address', 'satoshis', 'lockHeight', 'txBlockHeight', 'paymail'];
            const vls = [likedTxid, txid, app, address, satoshis, lockBlock, blockHeight, paymail]
            const stmt = sqlDB.insert('locks', flds, vls, true);
            await sqlDB.sqlPromise(stmt, 'Failed to insert lock.', '', pool);
            return;
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