require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: "0.8.22",
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL, // Sepolia RPC URL in your .env file
            accounts: [process.env.PRIVATE_KEY], // Private key of deployer wallet
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY, // Optional for contract verification
    },
};
