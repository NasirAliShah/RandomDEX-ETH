require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.22",
  networks: {
    mainnet: {
      url: process.env.ETH_MAINNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEYY],
      chainId: 1,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEYY],
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEYY],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY, // Ethereum Mainnet
      sepolia: process.env.ETHERSCAN_API_KEY, // Ethereum Sepolia
      base: process.env.BASESCAN_API_KEY,      // Base Mainnet
      baseSepolia: process.env.BASESCAN_API_KEY, // Base Sepolia (same key as Base Mainnet)
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api", // Base Sepolia API endpoint
          browserURL: "https://sepolia.basescan.org",     // Base Sepolia explorer
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};