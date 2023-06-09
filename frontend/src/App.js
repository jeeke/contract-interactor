import React, {useState} from 'react';
import axios from "axios";
import {parseUnits} from "ethers/lib/utils";
import {Contract, providers, utils} from "ethers";
import config from "./config";

async function getBackendWalletAddress() {
    try {
        const {data, status} = await axios.get(config.BACKEND_URL);
        return status === 200 ? data.toString() : 'Backend not connected!'
    }catch (e) {
        return 'Backend not connected!';
    }
}
const provider = new providers.AlchemyProvider(
    config.ALCHEMY_NETWORK,
    config.ALCHEMY_API_KEY
);

let backendWalletAddress = await getBackendWalletAddress();
let metamaskWallet;
function App() {
    const [contractAddress, setContractAddress] = useState(config.DEFAULT_CONTRACT);
    const [abi, setAbi] = useState(config.DEFAULT_ABI);
    const [selectedFunction, setSelectedFunction] = useState('');
    const [functionInputs, setFunctionInputs] = useState({});
    const [speed, setSpeed] = useState('fast');
    const [result, setResult] = useState('');
    const [isReadingContract, setIsReadingContract] = useState(true);
    const [metaMaskAddress, setMetaMaskAddress] = useState('');
    const [backendAddress, setBackendAddress] = useState(backendWalletAddress);
    const [walletType, setWalletType] = useState('backend')
    const [trackingLink, setTrackingLink] = useState('');
    const onWalletChange = async (e) => {
        const type = e.target.value;
        setWalletType(type);
        if(type === 'metamask' && window.ethereum && window.ethereum.isMetaMask) {
            if(metaMaskAddress && metamaskWallet) return;
            const [addr] = await window.ethereum.request({method: 'eth_requestAccounts'});
            const metaMaskProvider = new providers.Web3Provider(window.ethereum);
            metamaskWallet = metaMaskProvider.getSigner();
            setMetaMaskAddress(addr);
        } else {
            if(backendWalletAddress) return;
            const address = await getBackendWalletAddress();
            setBackendAddress(address)
        }
    }



    const getTxnOptions = async () => {
        const {data,status} = await axios.get("https://gasstation-mainnet.matic.network/v2");
        if (status !== 200 || !data.fast) throw new Error("Can't estimate gas fee");
        console.log(speed);
        return {
            maxPriorityFeePerGas: Math.ceil(data[speed]?.maxPriorityFee * 1e9),
            maxFeePerGas: Math.ceil(data[speed]?.maxFee * 1e9),
            gasLimit: 1000000
        };
    }

    const handleInputChange = (event) => {
        const {name, value} = event.target;
        setFunctionInputs((prevInputs) => ({...prevInputs, [name]: value}));
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const selectedFunctionData = abi.find((func) => func.name === selectedFunction);
        const values = [];
        for (const input of selectedFunctionData.inputs) {
            values.push(functionInputs[input.name]);
        }
        if(selectedFunctionData.stateMutability === 'view') {
            const contract = new Contract(contractAddress, abi, provider);
            const result = await contract[selectedFunction](...values);
            setResult(result);
            return;
        }

        const value = parseUnits(functionInputs.valueTxn || '0', 'ether').toHexString();
        const accountInterface = new utils.Interface(abi);
        const sendData = accountInterface.encodeFunctionData(selectedFunction, values);
        const txn = {
            to: contractAddress,
            value,
            data: sendData,
            ...(await getTxnOptions(speed))
        };
        let res;
        if(walletType === 'metamask') {
            res = await metamaskWallet.sendTransaction(txn);
        } else {
            try {
                const backendRes = await axios.post(config.BACKEND_URL, txn);
                res = backendRes.data;
            }catch (e) {
                res = e
            }
        }
        setResult(JSON.stringify(res, null, 4));
        res?.hash && setTrackingLink(`https://polygonscan.com/tx/${res.hash}`)
    };

    const handleFunctionSelect = (event) => {
        const func = event.target.value;
        const funcData = abi.find((f) => f.name === func);
        setIsReadingContract(funcData.stateMutability === 'view')
        setSelectedFunction(func);
        setFunctionInputs({});
    };

    const showFunctionInputs = () => {
        const selectedFunctionData = abi.find((func) => func.name === selectedFunction);

        if (selectedFunctionData) {
            return (
                <div>
                    {selectedFunctionData.stateMutability !== 'view' &&
                        <div key='valueTxn' style={{marginTop: '10px'}}>
                            <label htmlFor='valueTxn'>
                                value(in eth - 0.001)
                                <input
                                    type="text"
                                    id="valueTxn"
                                    name="valueTxn"
                                    value={functionInputs["valueTxn"] || '0'}
                                    onChange={handleInputChange}
                                    style={{marginLeft: '20px'}}
                                />
                            </label>
                        </div>
                    }
                    {selectedFunctionData.inputs.map((input) => (
                        <div key={input.name}  style={{marginTop: '20px'}}>
                            <label htmlFor={input.name}>
                                {input.name}
                                <input
                                    type="text"
                                    id={input.name}
                                    name={input.name}
                                    value={functionInputs[input.name] || ''}
                                    onChange={handleInputChange}
                                    style={{marginLeft: '20px'}}
                                />
                            </label>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };
    return (
        <div className="App">
            <h1>Contract Interaction</h1>
            <br/>
            <form onSubmit={handleFormSubmit}>
                <label htmlFor="wallet">Select Wallet</label>
                <select id="wallet" onChange={onWalletChange} value={walletType} required>
                    <option value='backend'>Backend - {backendAddress}</option>
                    <option value='metamask'>Metamask - {metaMaskAddress}</option>
                </select>
                <br/>
                <br/>
                <label htmlFor="speed">Select Speed</label>
                <select id="speed" onChange={(event) => {setSpeed(event.target.value)}} value={speed} required>
                    <option value='fast'>fast</option>
                    <option value='standard'>standard</option>
                    <option value='safeLow'>safeLow</option>
                </select>
                <br/>
                <br/>
                <label htmlFor="contractAddress">Contract Address</label>
                <input
                    type="text"
                    id="contractAddress"
                    name="contractAddress"
                    value={contractAddress}
                    onChange={(event) => setContractAddress(event.target.value)}
                    required
                />
                <br/>
                <br/>
                <br/>
                <label htmlFor="abi">ABI:</label>
                <textarea
                    id="abi"
                    name="abi"
                    rows="10"
                    value={JSON.stringify(abi, undefined, 4)}
                    onChange={(event) => setAbi(JSON.parse(event.target.value))}
                    required
                />
                <br/>
                <br/>

                <label htmlFor="functionSelect" style={{ opacity: isReadingContract ? 1 : 0.5 }}>Read Contract</label>
                <select id="functionSelect" onChange={handleFunctionSelect} value={selectedFunction} required style={{ opacity: isReadingContract ? 1 : 0.5 }}>
                    <option value="" disabled>Select a function</option>
                    {
                        abi.filter(obj => obj.type === 'function' && obj.stateMutability === 'view').map((func) => (
                            <option key={func.name} value={func.name}>
                                {func.name}
                            </option>
                        ))
                    }
                </select>
                <br/>
                <br/>

                <label htmlFor="functionSelect" style={{ opacity: isReadingContract ? 0.5 : 1 }}>Write to Contract</label>
                <select id="functionSelect" onChange={handleFunctionSelect} value={selectedFunction} required  style={{ opacity: isReadingContract ? 0.5 : 1 }}>
                    <option value="" disabled>Select a function</option>
                    {
                        abi.filter(obj => obj.type === 'function' && obj.stateMutability !== 'view').map((func) => (
                            <option key={func.name} value={func.name}>
                                {func.name}
                            </option>
                        ))
                    }
                </select>
                <br/>
                <br/>

                <div>{showFunctionInputs()}</div>
                <br/>

                <button type="submit">Send Transaction</button>
            </form>
            <br/>
            <div>
                <h1>Result</h1>
                {trackingLink && <a href={trackingLink} target="_blank" rel="noopener noreferrer">
                    View Transaction
                </a>}
                <pre>{result}</pre>
            </div>
            <br/>
            <br/>
            <br/>
            <br/>
            <br/>

        </div>
    );
}

export default App;

