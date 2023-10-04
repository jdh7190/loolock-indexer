const fs = require('fs');
const csv = require('csv-parser');
const fetch = require('node-fetch');
const main = async() => {
    fs.createReadStream('./missing_paymail_tx.csv').pipe(csv())
    .on('data', async data => {
        try {
            await fetch(`http://localhost:9007/updateLockPaymail`, {
                method: 'post',
                body: JSON.stringify({
                    paymail: data.paymail,
                    txid: data.txid
                })
            })
        } catch(e) {
            console.log(e)
        }
    })
    .on('end', () => {
        console.log('DONE')
    })
}
main();