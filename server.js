require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const sqlDB = require('./sqlDB');
const app = express(), port = process.env.SERVER_PORT;
app.use(express.static('public'));
app.use(express.json({type:['application/json', 'text/plain'], limit:'50mb'}));
app.use(express.urlencoded({extended:true, limit:'50mb'}));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type");
    next();
});
app.use(express.text({limit:'50mb'}))
const pool = sqlDB.pool(true);
app.get('/', (req, res) => {res.sendFile('index.html', { root: __dirname })});
app.get('/lockcrawl', async(req, res) => {
    try {
        const stmt = `SELECT height, hash from lockcrawl LIMIT 1`;
        const r = await sqlDB.sqlPromise(stmt, '', 'No record in lockcrawl found.', pool);
        if (r?.length) {
            res.send(r[0]);
        } else { throw `No lock crawl record found.` }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
app.post('/lockcrawl', async(req, res) => {
    const { height, hash } = req.body;
    try {
        const selectStmt = `SELECT height, hash from lockcrawl LIMIT 1`;
        const rs = await sqlDB.sqlPromise(selectStmt, '', 'No record in lockcrawl found.', pool);
        if (rs?.length) {
            const stmt = `UPDATE lockcrawl set height = '${height}', hash = '${hash}' where id = '1' OR id = '0'`;
            const r = await sqlDB.sqlPromise(stmt, 'Error inserting into lockcrawl.', 'No record in lockcrawl found.', pool);
            if (r.affectedRows > 0) {
                console.log(`Updated lock lockcrawl height ${height}.`);
            }
            res.sendStatus(200);
        } else {
            const fields = ['height', 'hash'];
            const values = [height, hash];
            const stmt = sqlDB.insert('lockcrawl', fields, values, true);
            const is = await sqlDB.sqlPromise(stmt, '', '', pool);
            if (is.affectedRows > 0) {
                console.log(`Inserted lockcrawl record with start height ${height}.`);
            }
            res.sendStatus(200);
        }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
const lockIdx = async payload => {
    try {
        const { content, txid, app, paymail, txBlockHeight, lockHeight, satoshis, likedTxid, address, contextTx } = payload;
        const flds = ['content', 'txid', 'app', 'paymail', 'txBlockHeight', 'lockHeight', 'satoshis', 'likedTxid', 'address', 'contextTx'];
        const contentText = replaceAll(content, "'", "''");
        const vls = [contentText, txid, app, paymail, txBlockHeight, lockHeight, satoshis, likedTxid, address, contextTx];
        const stmt = sqlDB.insert('locks', flds, vls, true);
        const r = await sqlDB.sqlPromise(stmt, 'Failed to insert lock.', '', pool);
        return r;
    } catch(e) {
        console.log(e);
        return {error:e}
    }
}
app.post('/postLock', async(req, res) => {
    try {
        await lockIdx(req.body);
        res.sendStatus(200);
    } catch(e) {
        console.log({e});
        res.send({error: e});
    }
});
app.post('/updateLockBlock', async(req, res) => {
    try {
        const { txBlockHeight, txid } = req.body;
        const stmt = `UPDATE locks set txBlockHeight = ${parseInt(txBlockHeight)} where txid = '${txid}'`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to update lock record for ${txid}`, '', pool);
        if (r) {
            res.sendStatus(200);
        }
    } catch(e) {
        console.log(e);
        return {error:e}
    }
})
app.post('/updateLockPaymail', async(req, res) => {
    try {
        const { paymail, txid } = req.body;
        const stmt = `UPDATE locks set paymail = '${paymail}' where txid = '${txid}'`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to update paymail lock record for ${txid}`, '', pool);
        if (r) {
            res.sendStatus(200);
        }
    } catch(e) {
        console.log(e);
        return {error:e}
    }
})
app.post('/getLocks', async(req, res) => {
    try {
        const { fromHeight, toHeight, address } = req.body;
        const stmt = `SELECT txid FROM mornin.locks where address = '${address}' AND lockHeight <= ${toHeight} AND lockHeight >= ${fromHeight}`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to retrieve lock records for ${address} between blocks ${fromHeight} and ${toHeight}`, '', pool);
        if (r?.length) { res.send(r) }
        else { throw `Failed to retrieve lock records for ${address} between blocks ${fromHeight} and ${toHeight}` }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
const getBlock = async() => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/chain/info`);
    const res = await r.json();
    return res?.blocks;
}
app.get('/totalLocked', async(req, res) => {
    try {
        const curBlockHeight = await getBlock();
        const stmt = `select sum(satoshis) as satoshis from locks where lockHeight > ${curBlockHeight}`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to retrieve total locked.`, '', pool);
        if (r?.length) { res.send({satoshis: r[0].satoshis}) }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
app.get('/lockedLeaderboard', async(req, res) => {
    try {
        const curBlockHeight = await getBlock();
        const stmt = `select paymail, sum(satoshis) as satoshis from locks where lockHeight > ${curBlockHeight} 
            AND paymail is not null and paymail != '' group by address order by satoshis desc`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to retrieve total locked.`, '', pool);
        if (r?.length) { res.send(r) }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
app.listen(port, async() => {
    await sqlDB.initializeDB();
    console.log(`Server listening on port ${port}...`)
});