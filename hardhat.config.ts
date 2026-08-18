// Force ts-node to use CommonJS mode
// This must be set before any imports
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
})

// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import '@nomicfoundation/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy-ethers'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'
import '@typechain/hardhat'
import '@nomicfoundation/hardhat-verify'

import { HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import './tasks/index'

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

let accounts: HttpNetworkAccountsUserConfig | undefined
if (MNEMONIC) {
    accounts = { mnemonic: MNEMONIC }
} else if (PRIVATE_KEY) {
    accounts = [PRIVATE_KEY]
} else {
    accounts = undefined
}

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const config = {
    paths: {
        cache: 'cache/hardhat',
        tests: 'test/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.22',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    // typechain is injected by '@typechain/hardhat' plugin, but
    // not present in HardhatUserConfig type by default.
    typechain: {
        outDir: 'typechain-types',
        target: 'ethers-v5',
    },
    networks: {
        'bsc-mainnet': {
            eid: EndpointId.BSC_V2_MAINNET,
            url: process.env.RPC_URL_BSC_MAINNET || 'https://bsc-mainnet.gateway.tenderly.co',
            accounts,
        },
        'eth-mainnet': {
            eid: EndpointId.ETHEREUM_V2_MAINNET,
            url: process.env.RPC_URL_ETH_MAINNET || 'https://eth-mainnet.gateway.tenderly.co',
            accounts,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
    etherscan: {
        apiKey: {
            'bsc-mainnet': process.env.BSCSCAN_API_KEY || '',
            'eth-mainnet': process.env.ETHERSCAN_API_KEY || '',
        },
        customChains: [
            {
                network: 'bsc-mainnet',
                chainId: 56,
                urls: {
                    apiURL: 'https://api.etherscan.io/v2/api?chainid=56',
                    browserURL: 'https://bscscan.com',
                },
            },
            {
                network: 'eth-mainnet',
                chainId: 1,
                urls: {
                    apiURL: 'https://api.etherscan.io/v2/api?chainid=1',
                    browserURL: 'https://etherscan.io',
                },
            },
        ],
    },
}

export default config
