// Script to assign DEX role to a pair address
const { ethers } = require("ethers");
require("dotenv").config();

// ABI for granting roles (minimal)
const tokenAbi = [
  "function grantRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) external view returns (bool)"
];

// DEX role hash
const DEX_ROLE = "0x3d962df346299889e3ddd098bdd68cf335a1e370339bd306448317d39b39a66d";

async function main() {
  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    
    // Get signer from private key
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Private key not found in environment variables");
    }
    const signer = new ethers.Wallet(privateKey, provider);
    console.log(`Using wallet address: ${signer.address}`);
    
    // Token contract address (RDX token on Base)
    const tokenAddress = "0x4610B57C61fcA35b13c8885be9fF8857436eaD5f";
    console.log(`Token contract address: ${tokenAddress}`);
    
    // Create contract instance
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);
    
    // Pair address to grant DEX role to
    const pairAddress = "0xa836d7E3d83D3773332a573D6575Bd33075bE51e";
    console.log(`Pair address to grant DEX role: ${pairAddress}`);
    
    // Check if the pair address already has the DEX role
    const hasRole = await tokenContract.hasRole(DEX_ROLE, pairAddress);
    if (hasRole) {
      console.log(`Pair address ${pairAddress} already has the DEX role`);
      return;
    }
    
    // Grant DEX role to pair address
    console.log(`Granting DEX role to pair address ${pairAddress}...`);
    const tx = await tokenContract.grantRole(DEX_ROLE, pairAddress);
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    console.log("Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify role assignment
    const hasRoleAfter = await tokenContract.hasRole(DEX_ROLE, pairAddress);
    if (hasRoleAfter) {
      console.log(`✅ DEX role successfully granted to pair address ${pairAddress}`);
    } else {
      console.log(`❌ Failed to grant DEX role to pair address ${pairAddress}`);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
