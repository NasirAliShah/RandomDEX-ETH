const { ethers } = require("hardhat");

// Usage: npx hardhat run scripts/check-specific-pair.js --network baseSepolia -- <token0Address> <token1Address>
// Example: npx hardhat run scripts/check-specific-pair.js --network baseSepolia -- 0x4200000000000000000000000000000000000006 0xFccCb96dD3E2A7349EF824D4431568dBf52015D7

// Factory and Router addresses
const FACTORY_ADDRESS = "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e"; // Base Sepolia Factory
const ROUTER_ADDRESS = "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602"; // Base Sepolia Router
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base Sepolia

// ABIs
const factoryABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const pairABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const erc20ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function balanceOf(address) view returns (uint256)"
];

async function getTokenInfo(tokenAddress, provider) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const name = await tokenContract.name();
    return { symbol, decimals, name };
  } catch (error) {
    console.error(`Error getting token info for ${tokenAddress}:`, error.message);
    return { symbol: 'UNKNOWN', decimals: 18, name: 'Unknown Token' };
  }
}

async function main() {
  try {
    // Default token addresses if not provided (WETH and MAK from our previous run)
    let token0Address = "0x4200000000000000000000000000000000000006"; // WETH
    let token1Address = "0xFccCb96dD3E2A7349EF824D4431568dBf52015D7"; // MAK
    
    // Check if we have command line arguments
    if (process.env.TOKEN0 && process.env.TOKEN1) {
      token0Address = process.env.TOKEN0;
      token1Address = process.env.TOKEN1;
      console.log("Using token addresses from environment variables");
    } else {
      console.log("Using default token addresses (WETH and MAK)");
      console.log("To check other pairs, set TOKEN0 and TOKEN1 environment variables");
      console.log("Example: TOKEN0=0x... TOKEN1=0x... npx hardhat run scripts/check-specific-pair.js --network baseSepolia");
    }

    console.log(`Checking pair for tokens: ${token0Address} and ${token1Address}`);

    // Connect to the network
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    console.log("Connected to Base Sepolia testnet");
    
    // Get token info
    const token0Info = await getTokenInfo(token0Address, provider);
    const token1Info = await getTokenInfo(token1Address, provider);
    
    console.log(`Token0: ${token0Info.symbol} (${token0Info.name})`);
    console.log(`Token1: ${token1Info.symbol} (${token1Info.name})`);

    // Connect to the factory contract
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
    
    // Get the pair address
    const pairAddress = await factoryContract.getPair(token0Address, token1Address);
    
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      console.log("❌ No pair exists for these tokens");
      return;
    }
    
    console.log(`✅ Found pair at address: ${pairAddress}`);
    
    // Connect to the pair contract
    const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
    
    // Get the reserves
    const [reserve0, reserve1, _] = await pairContract.getReserves();
    
    // Verify token order (Uniswap sorts tokens by address)
    const actualToken0 = await pairContract.token0();
    const actualToken1 = await pairContract.token1();
    
    console.log(`Pair tokens: ${actualToken0} (${actualToken0 === token0Address ? token0Info.symbol : token1Info.symbol}) and ${actualToken1} (${actualToken1 === token1Address ? token1Info.symbol : token0Info.symbol})`);
    
    // Format reserves based on decimals
    const formattedReserve0 = ethers.formatUnits(reserve0, actualToken0 === token0Address ? token0Info.decimals : token1Info.decimals);
    const formattedReserve1 = ethers.formatUnits(reserve1, actualToken1 === token1Address ? token1Info.decimals : token0Info.decimals);
    
    console.log(`Reserves:`);
    console.log(`- ${formattedReserve0} ${actualToken0 === token0Address ? token0Info.symbol : token1Info.symbol}`);
    console.log(`- ${formattedReserve1} ${actualToken1 === token1Address ? token1Info.symbol : token0Info.symbol}`);
    
    // Calculate approximate value if one token is WETH
    if (actualToken0 === WETH_ADDRESS) {
      console.log(`Approximate value: ${formattedReserve0} ETH`);
    } else if (actualToken1 === WETH_ADDRESS) {
      console.log(`Approximate value: ${formattedReserve1} ETH`);
    }
    
    console.log(`\nTo add liquidity to this pair, use the Uniswap V2 Router at: ${ROUTER_ADDRESS}`);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
