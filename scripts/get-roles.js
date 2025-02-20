const { ethers } = require("ethers");


// ✅ Replace with your contract address
const CONTRACT_ADDRESS = "0x2659631CfBE9B1b6DcBc1384a3864509356E7B4d";

// ✅ Compute the DEX_ROLE hash
const DEX_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DEX_ROLE"));

// ✅ ABI for RoleGranted event
const ABI = [
    "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)"
];

async function main() {
    // ✅ Connect to Alchemy Base Mainnet RPC
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_KEY);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    console.log(`🔍 Fetching all DEX_ROLE granted events from contract: ${CONTRACT_ADDRESS}`);

    // ✅ Fetch all RoleGranted events
    const events = await contract.queryFilter("RoleGranted");

    if (events.length === 0) {
        console.log("⚠️ No DEX_ROLE grants found.");
        return;
    }

    console.log("✅ DEX Addresses with DEX_ROLE:");
    events.forEach(event => {
        if (event.args.role === DEX_ROLE) {
            console.log("📌", event.args.account);
        }
    });
}

main().catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
});
