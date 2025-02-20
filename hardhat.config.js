require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: "0.8.22",
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL, // Sepolia RPC URL from .env file
            accounts: [
                process.env.PRIVATE_KEY,
                process.env.PRIVATE_KEYY
            ], // Multiple accounts
        },
        base: {  // ✅ Added Base Mainnet Configuration
            url: process.env.BASE_MAINNET_RPC_URL, // Base Mainnet RPC URL from .env file
            accounts: [
                process.env.PRIVATE_KEY,
                process.env.PRIVATE_KEYY
            ], // Multiple accounts
            chainId: 8453, // Base Mainnet Chain ID
        },
    },
    etherscan: {
        apiKey: {
            sepolia: process.env.ETHERSCAN_API_KEY, // Sepolia Etherscan API Key
            base: process.env.BASESCAN_API_KEY, // ✅ Added Base Mainnet API Key
        },
        customChains: [ // ✅ Add BaseScan support for verification
            {
                network: "base",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org",
                },
            },
        ],
    },
    sourcify: {
        enabled: true
    }
};
