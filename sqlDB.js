require('dotenv').config();
const mysql = require('mysql');
const insertStmt = (table, fields, values, ignore, upsert) => {
    let statement = `INSERT ${ignore === true ? 'IGNORE' : ''} INTO ${table} (`;
    for(let i=0;i<fields.length;i++) {
        statement+=fields[i];
        if (i===values.length-1) {
            statement+=') VALUES (';
        }
        else {
            statement+=',';
        }
    }
    for (let j=0;j<values.length;j++) {
        if (values[j]?.toString().includes('width=device-width')) { statement+=`"${values[j]}"` }
        else { statement+=`'${values[j]}'` }
        if (j===values.length-1) {
            statement+=')';
        }
        else {
            statement+=',';
        }
    }
    if (upsert) {
        statement += ' on duplicate key update';
        for (let k=0; k<values.length; k++) {
            statement += ` ${fields[k]}='${values[k]}'`;
            if (k !== values.length-1) {
                statement += ','
            }
        }
    }
    return statement;
}
const sqlPromise = (q, queryErr, notFoundErr, connection) => {
    let con = connection === undefined ? connect() : connection;
    try {
        return new Promise((resolve, reject) => {
            con.query(q, function (err, result) {
                if (err) {console.log(err); reject(new Error(queryErr));}
                if (result !== undefined){resolve(result)}
                else {reject(new Error(notFoundErr))}
            });
        });
    }
    catch (e) {
        console.log(e);
        return {error: e};
    }
}
const connect = database => {
    const connection = mysql.createConnection({
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database,
        charset: 'utf8mb4'
    });
    return connection;
}
const errorCon = (err, con, res) => {
    if (err) {
        console.log(err);
        con.end();
        res.send({error:err})
    }
}
const pool = multiple => {
    return mysql.createPool({
        connectionLimit: 10, charset: 'utf8mb4', multipleStatements: multiple === true ? true : false,
        host: process.env.DATABASE_HOST,user: process.env.DATABASE_USER,password: process.env.DATABASE_PASSWORD,database: process.env.DATABASE_NAME
    });
}
const initializeDB = async() => {
    const con = connect();
    await sqlPromise(`CREATE DATABASE IF NOT EXISTS ${process.env.DATABASE_NAME};`, `FAILED TO CREATE DATABASE ${process.env.DATABASE_NAME}`, '', con);
    const LOCK_TABLE_INIT_STMT = `CREATE TABLE IF NOT EXISTS LOCKS (
        id int NOT NULL AUTO_INCREMENT,
        txid varchar(64) NOT NULL,
        satoshis bigint DEFAULT NULL,
        address varchar(36) DEFAULT NULL,
        lockHeight int DEFAULT NULL,
        content mediumtext,
        app varchar(64) DEFAULT NULL,
        paymail varchar(100) DEFAULT NULL,
        txBlockHeight int DEFAULT NULL,
        likedTxid varchar(64) DEFAULT NULL,
        contextTx varchar(64) DEFAULT NULL,
        PRIMARY KEY (id,txid),
        UNIQUE KEY txid_UNIQUE (txid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    const dbCon = connect(process.env.DATABASE_NAME);
    await sqlPromise(LOCK_TABLE_INIT_STMT, 'FAILED TO CREATE LOCKS TABLE', '', dbCon);
    const LOCK_CRAWL_INIT_STMT = `CREATE TABLE IF NOT EXISTS lockcrawl (
        id int NOT NULL,
        height int DEFAULT NULL,
        hash varchar(64) DEFAULT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    await sqlPromise(LOCK_CRAWL_INIT_STMT, 'FAILED TO CREATE LOCKCRAWL TABLE', '', dbCon);
    const LIKE_TABLE_INIT_STMT = `CREATE TABLE IF NOT EXISTS likes (
        id int NOT NULL AUTO_INCREMENT,
        txid varchar(64) NOT NULL,
        likedTxid varchar(84) DEFAULT NULL,
        emoji varchar(24) DEFAULT NULL,
        hexcode varchar(45) DEFAULT NULL,
        address varchar(36) DEFAULT NULL,
        satoshis bigint DEFAULT NULL,
        txBlockHeight int DEFAULT NULL,
        paymail varchar(100) DEFAULT NULL,
        lockHeight int DEFAULT NULL,
        app varchar(100) DEFAULT NULL,
        PRIMARY KEY (id,txid),
        UNIQUE KEY txid_UNIQUE (txid)
      ) ENGINE=InnoDB AUTO_INCREMENT=7400 DEFAULT CHARSET=utf8mb4`;
    await sqlPromise(LIKE_TABLE_INIT_STMT, 'FAILED TO CREATE LIKE TABLE', '', dbCon);
    const REPLY_TABLE_INIT_STMT = `CREATE TABLE IF NOT EXISTS replies (
        id int NOT NULL AUTO_INCREMENT,
        txid varchar(64) NOT NULL,
        repliedTxid varchar(64) DEFAULT NULL,
        content longtext,
        txBlockHeight int DEFAULT NULL,
        lockHeight int DEFAULT NULL,
        address varchar(36) DEFAULT NULL,
        satoshis bigint DEFAULT NULL,
        paymail varchar(100) DEFAULT NULL,
        app varchar(100) DEFAULT NULL,
        PRIMARY KEY (id,txid),
        UNIQUE KEY txid_UNIQUE (txid)
      ) ENGINE=InnoDB AUTO_INCREMENT=18873 DEFAULT CHARSET=utf8mb4;`
    await sqlPromise(REPLY_TABLE_INIT_STMT, 'FAILED TO CREATE REPLY TABLE', '', dbCon)
    console.log(`DATABASE ${process.env.DATABASE_NAME} INITIALIZED`);
    con.destroy();
    dbCon.destroy();
    return;
}
exports.insert = insertStmt;
exports.connect = connect;
exports.errorCon = errorCon;
exports.pool = pool;
exports.sqlPromise = sqlPromise;
exports.initializeDB = initializeDB;