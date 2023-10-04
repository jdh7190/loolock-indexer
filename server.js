require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const sqlDB = require('./sqlDB');
const app = express(), port = process.env.SERVER_PORT;
const DB_NAME = process.env.DATABASE_NAME;
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
const getCrawlHeight = async() => {
    const stmt = `SELECT height from lockcrawl LIMIT 1`;
    try {
        const r = await sqlDB.sqlPromise(stmt, '', 'No record in lockcrawl found.', pool);
        return parseInt(r[0].height);
    } catch(e) {
        console.log(e);
        return {error:e}
    }
}
app.get('/lockcrawl', async(req, res) => {
    try {
        const lc = await getCrawlHeight();
        res.send({height:lc});
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
        const lstmt = `UPDATE likes set paymail = '${paymail}' where txid = '${txid}'`;
        const rstmt = `UPDATE replies set paymail = '${paymail}' where txid = '${txid}'`;
        const r = await sqlDB.sqlPromise(`${stmt};${lstmt};${rstmt}`, `Failed to update paymail lock record for ${txid}`, '', pool);
        if (r) {
            res.sendStatus(200);
        }
    } catch(e) {
        console.log(e);
        return {error:e}
    }
})
app.post('/getLatestLocks', async(req, res) => {
    try {
        const curBlockHeight = await getCrawlHeight();
        const stmt = `SELECT txid, content, paymail FROM locks.locks where likedTxid is null and contextTx is null and lockHeight > ${curBlockHeight} order by txBlockHeight desc LIMIT 50`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to retrieve lock records for ${address} between blocks ${fromHeight} and ${toHeight}`, '', pool);
        if (r?.length) { res.send(r) }
        else { throw `Failed to retrieve lock records for ${address} between blocks ${fromHeight} and ${toHeight}` }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
app.get('/getLock', async(req, res) => {
    const { txid } = req.query;
    try {
        const curBlockHeight = await getCrawlHeight();
        const stmt = `SELECT locks.txid, content, count(likes.id) as likeCount, locks.paymail, (coalesce(locks.satoshis, 0) + coalesce(sum(likes.satoshis), 0)) as satoshis FROM locks
            left outer join locks.likes on locks.txid = likes.likedTxid
        where locks.txid = '${req.query.txid}'
        group by locks.id order by locks.txBlockHeight desc`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to get lock for txid ${txid}.`, `No lock for txid ${txid}.`, pool);
        const replyStmt = `SELECT replies.txid, content, count(likes.id) as likeCount, replies.paymail as paymail, (coalesce(replies.satoshis, 0) + coalesce(sum(likes.satoshis), 0)) as satoshis FROM locks.replies
            left outer join likes on replies.txid = likes.likedTxid
            where repliedTxid = '${txid}' AND replies.lockHeight > ${curBlockHeight}
            group by replies.id
            order by likeCount asc`;
        const rs = await sqlDB.sqlPromise(replyStmt, `Failed to get replies for ${txid}.`, `No replies for txid ${txid}.`, pool);
        res.send({ post: r, replies: rs});
    } catch (e) {
        console.log(e);
        res.send({error:'Failed to fetch from database.'});
    }
});
app.get('/getLocks', async(req, res) => {
    const { order, paymail } = req.query;
    let orderBy = 'locks.txBlockHeight desc, locks.id desc';
    if (order === '0') { orderBy = 'locks.txBlockHeight desc, locks.id desc' }
    else if (order === '1') { orderBy = 'likeCount desc' }
    else if (order === '2') { orderBy = 'satoshis desc' }
    else if (order === '3') { orderBy = 'locks.lockHeight desc' }
    let paymailClause = '';
    if (paymail?.includes('@')) {
        paymailClause = paymail ? ('AND locks.paymail = ' + "'" + paymail + "'") : '';
    } else if (paymail?.length > 0) {
        paymailClause = `AND locks.paymail LIKE '%${paymail}%'`;
    }
    try {
        const curBlockHeight = await getCrawlHeight();
        const stmt = `SELECT locks.paymail, locks.txid, locks.content, count(likes.id) as likeCount, locks.paymail, sum(likes.satoshis) as satoshis, locks.satoshis as postSatoshis FROM locks.locks
            left outer join locks.likes on locks.txid = likes.likedTxid
        where locks.lockHeight > ${curBlockHeight} ${paymailClause}
        group by locks.id
        order by ${orderBy} LIMIT 50`;
        const r = await sqlDB.sqlPromise(stmt, 'Failed to query for locks.', 'No locks found.', pool);
        const rStmt = `SELECT count(replies.id) as replyCount, locks.txid FROM locks.locks
            left outer join locks.replies on locks.txid = replies.repliedTxid
            where replies.lockHeight > ${curBlockHeight}
        group by locks.id`;
        const rs = await sqlDB.sqlPromise(rStmt, '', '', pool);
        const replies = rs.filter(reply => reply.replyCount > 0);
        replies.forEach(reply => {
            const found = r.findIndex(x => x.txid === reply.txid);
            if (found > -1) {
                r[found].replyCount = reply.replyCount;
            }
        })
        res.send(r);
    } catch (e) {
        console.log(e);
        res.send({error:'Failed to fetch from database.'});
    }
});
app.get('/totalLocked', async(req, res) => {
    try {
        const curBlockHeight = await getCrawlHeight();
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
        const curBlockHeight = await getCrawlHeight();
        const stmt = `select paymail, sum(satoshis) as satoshis from locks where lockHeight > ${curBlockHeight} 
            AND paymail is not null and paymail != '' group by address order by satoshis desc`;
        const r = await sqlDB.sqlPromise(stmt, `Failed to retrieve total locked.`, '', pool);
        const lstmt = `select paymail, sum(satoshis) as satoshis from likes where lockHeight > ${curBlockHeight} 
            AND paymail is not null and paymail != '' group by address order by satoshis desc`;
        const l = await sqlDB.sqlPromise(lstmt , `Failed to retrieve likes leaderboard`, '', pool);
        const arr = [...r, ...l].reduce((acc, val, i, arr) => {
            const { paymail, satoshis } = val;
            const ind = acc.findIndex(el => el.paymail === paymail);
            if (ind !== -1) { acc[ind].satoshis += satoshis;
            } else { acc.push({ paymail, satoshis }) }
            return acc;
         }, []);
        if (r?.length && l?.length) {
            res.send(arr);
        }
    } catch(e) {
        console.log(e);
        res.send({error:e})
    }
})
app.listen(port, async() => {
    await sqlDB.initializeDB();
    console.log(`Server listening on port ${port}...`)
});