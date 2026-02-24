// Script to check token liquidity on Uniswap for a specific address
const { ethers } = require("ethers");
require("dotenv").config();

// Uniswap Router ABI (minimal)
const routerAbi = [
  "function WETH() external pure returns (address)",
  "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)",
  "function factory() external pure returns (address)"
];

// Factory ABI (minimal)
const factoryAbi = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

// ERC20 ABI (minimal for token information)
const erc20Abi = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

async function main() {
  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    
    // Specific token address to check
    const tokenAddress = "0x4610B57C61fcA35b13c8885be9fF8857436eaD5f";
    
    console.log("Checking liquidity for token on Base Sepolia...");
    console.log(`Token address: ${tokenAddress}`);
    
    // Try to get token information
    try {
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name().catch(() => "Unknown"),
        tokenContract.symbol().catch(() => "Unknown"),
        tokenContract.decimals().catch(() => 18)
      ]);
      console.log(`Token info - Name: ${name}, Symbol: ${symbol}, Decimals: ${decimals}`);
    } catch (error) {
      console.log("Could not fetch token information. This might not be an ERC20 token.");
    }
    
    // Get Uniswap router address from contract
    // This is a common Uniswap V2 router address on Base Sepolia, adjust if needed
    const routerAddress = "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602";
    console.log("Using Uniswap router:", routerAddress);
    
    // Create router contract instance
    const router = new ethers.Contract(routerAddress, routerAbi, provider);
    
    // Get WETH address
    const wethAddress = await router.WETH();
    console.log("WETH address:", wethAddress);
    
    // Get factory address
    const factoryAddress = await router.factory();
    console.log("Factory address:", factoryAddress);
    
    // Create factory contract instance
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    
    // Check if pair exists
    const pairAddress = await factory.getPair(wethAddress, tokenAddress);
    console.log("Pair address:", pairAddress);
    
    if (pairAddress === ethers.ZeroAddress) {
      console.log("No liquidity pool exists for this token");
      return;
    }
    
    // Check liquidity using getAmountsOut
    const path = [wethAddress, tokenAddress];
    const amountIn = ethers.parseEther("0.01"); // 0.01 ETH
    
    try {
      const amounts = await router.getAmountsOut(amountIn, path);
      console.log("Amount in:", ethers.formatEther(amountIn), "ETH");
      console.log("Amount out:", amounts[1].toString(), "tokens");
      console.log("Liquidity exists for this token");
      
      // Check reverse direction (token to ETH)
      const reversePath = [tokenAddress, wethAddress];
      // Use a reasonable amount based on decimals (assuming 18 for now)
      const tokenAmountIn = ethers.parseUnits("1", 18); // 1 token
      
      try {
        const reverseAmounts = await router.getAmountsOut(tokenAmountIn, reversePath);
        console.log("\nReverse direction check:");
        console.log("Token amount in:", ethers.formatUnits(tokenAmountIn, 18), "tokens");
        console.log("ETH amount out:", ethers.formatEther(reverseAmounts[1]), "ETH");
      } catch (error) {
        console.log("\nCould not check reverse direction (token to ETH):", error.message);
      }
    } catch (error) {
      console.log("Error checking amounts out:", error.message);
      console.log("No liquidity for this token");
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
