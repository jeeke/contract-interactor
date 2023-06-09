const dotenv = require('dotenv');
dotenv.config();
const {providers, Wallet} = require('ethers');
const express = require('express');
const app = express();
const cors = require('cors');
const port = 3354;

const provider = new providers.AlchemyProvider(
    process.env.ALCHEMY_NETWORK,
    process.env.ALCHEMY_API_KEY
);
let wallet;

async function getWallet(provider) {
    switch (process.env.WALLET_TYPE) {
        case 'pvt_key': {
            const k = process.env.WALLET_SECRET
            return new Wallet(k, provider);
        }
        default: {
            console.error('Wallet type not set & MetaMask not detected')
            throw new Error('Wallet type not set & MetaMask not detected');
        }
    }
}

app.use(
    cors({
        origin: 'http://localhost:3000'
    })
);

app.get('', async (req, res) => {
    res.send(wallet.address);
})

app.post('', async (req, res) => {
    const txnRes = await wallet.sendTransaction(req.body);
    console.log(txnRes)
    res.send(txnRes);
});

app.listen(port, async () => {
    console.log('Backend started listening on ', port);
    wallet = await getWallet(provider);
})
