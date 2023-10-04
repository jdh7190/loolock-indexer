# LooLockJS Indexer

## Introduction

The LooLockJS indexer is a NodeJS program that Bitcoin transactions containing a lockup script prefix, and adhere to the MAP protocol.

### Installation

Clone this repository, then run the command:

```npm install```

### Configuration

Create a .env file with the following parameters (THIS IS MANDATORY):

| Name | Description | Example |
| ----------- | ----------- | ----------- |
| DATABASE_NAME | Name of mysql database schema | locks |
| DATABASE_USER | mysql user with access to database | root |
| DATABASE_HOST | host of mysql instance | localhost |
| DATABASE_PASSWORD | mysql password for DATABASE_USER | p@ssw0rd |
| SERVER_PORT | PORT that server.js runs on | 9007 |
| MAP_SUBSCRIPTION | JungleBus Subscription ID to fetch MAP Bitcoin transactions | |
| API_URL | JungleBus Subscription ID to fetch MAP Bitcoin transactions | |
| BLOCK_HEIGHT | Block height to populate the lockcrawl table with upon initial indexing | 808839 | 

### Setup

Start the Express server that hosts the endpoints:

```node server```

This will initialize the database with 2 tables, locks and lockcrawl

lockcrawl manages the synced block height and hash. The indexer will start from this height upon running.

locks contains each lock record, with its BSocial data, satoshis locked, block height and more.

Once complete run the JungleBus indexer:

```npm run idx```

### Database Schema

lockcrawl

| Name | Description | Data Type | Example |
| ----------- | ----------- | ----------- | ----------- |
| txid | Bitcoin transaction ID | varchar(64) |  |
| satoshis | Amount of satoshis locked | bigint | 2100000000 |
| address | Address of private key that signs to unlock the coins | bigint | 2100000000 |
| lockHeight | Block when satoshis unlock | int | 1000000 |
| content | BSocial content | MEDIUMTEXT | Keep fading, anon |
| app | BSocial app name | varchar(64) | hodlocker.com |
| paymail | Paymail of locker and poster | varchar(100) | cryptoacorns@relayx.io |
| txBlockHeight | Block height of txid | int | 809000 |
| likedTxid | LooLiked txid | varchar(64) | |
| contextTx | Replied txid, or other context | varchar(64) | |

locks

### Endpoints

To be documented -

### Special steps

#### BSocial implementation

Locks started adhering to the BSocial protocol from block height 808839.

The locktx_before_BSocial.csv contains all records before this point, and is compatible with the locks table schema.

Import it using a client such as mysql workbench, or leverage the code in the update.js file.

#### Paymail mapping

The missing_paymail_tx.csv contains txids mapped to paymails from the LooLike bug in September 2023, as well as from RelayX accounts that have made on-chain transactions for where there was no on-chain paymail mapping.

Run the update.js file after the database is populated up to block height 812414:

```node update```

#### Additional paymail mapping

Once the indexer syncs to the current block height, run the following mysql queries:

Update missing addresses:

```sql 
UPDATE locks inner join 
    (SELECT address, paymail FROM locks.locks 
        where paymail is not null and paymail != '' 
        AND address is not null group by address
    ) lockuser 
    ON lockuser.paymail = locks.paymail
    SET locks.address = lockuser.address

```

Update missing paymails:

```sql 
UPDATE locks inner join 
    (SELECT address, paymail FROM locks.locks 
        where paymail is not null and paymail != '' 
        AND address is not null group by address
    ) lockuser 
    ON lockuser.paymail = locks.paymail
    SET locks.paymail = lockuser.paymail

```