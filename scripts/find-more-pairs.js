const { ethers } = require("hardhat");

// Factory address
const FACTORY_ADDRESS = "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e"; // Base Sepolia Factory
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base Sepolia

// ABIs
const factoryABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)"
];

const pairABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const erc20ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)"
];

async function getTokenInfo(tokenAddress, provider) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const name = await tokenContract.name();
    return { symbol, decimals, name, address: tokenAddress };
  } catch (error) {
    console.error(`Error getting token info for ${tokenAddress}:`, error.message);
    return { symbol: 'UNKNOWN', decimals: 18, name: 'Unknown Token', address: tokenAddress };
  }
}

async function main() {
  try {
    console.log("Looking for more pairs with liquidity on Uniswap V2 (Base Sepolia)...");

    // Connect to the network - try multiple RPC URLs for better reliability
    let provider;
    const rpcUrls = [
      process.env.BASE_SEPOLIA_RPC_URL,
      "https://sepolia.base.org",
      "https://base-sepolia-rpc.publicnode.com",
      "https://base-sepolia.blockpi.network/v1/rpc/public"
    ];
    
    // Try each RPC URL until one works
    for (const url of rpcUrls) {
      try {
        if (!url) continue;
        provider = new ethers.JsonRpcProvider(url);
        await provider.getBlockNumber(); // Test the connection
        console.log(`Connected to Base Sepolia testnet using ${url}`);
        break;
      } catch (error) {
        console.log(`Failed to connect using ${url}: ${error.message}`);
      }
    }
    
    if (!provider) {
      throw new Error("Failed to connect to any Base Sepolia RPC endpoint");
    }
    
    // Connect to the factory contract
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);
    
    // Look back much further - 1,000,000 blocks or from block 0 if the chain is newer
    const fromBlock = Math.max(0, currentBlock - 1000000);
    console.log(`Querying from block ${fromBlock} to ${currentBlock}`);
    
    // Get all PairCreated events
    const filter = factoryContract.filters.PairCreated();
    console.log('Fetching PairCreated events...');
    const events = await factoryContract.queryFilter(filter, fromBlock, currentBlock);
    console.log(`Found ${events.length} PairCreated events`);

    // Check liquidity for each pair
    const pairsWithLiquidity = [];
    
    console.log("Checking liquidity for each pair...");
    for (let i = 0; i < events.length; i++) {
      try {
        const event = events[i];
        const { token0, token1, pair } = event.args;
        
        // Get pair info
        const pairContract = new ethers.Contract(pair, pairABI, provider);
        const [reserve0, reserve1] = await pairContract.getReserves();
        
        // Skip pairs with no liquidity
        if (reserve0.toString() === '0' && reserve1.toString() === '0') {
          continue;
        }
        
        // Get token info
        const token0Info = await getTokenInfo(token0, provider);
        const token1Info = await getTokenInfo(token1, provider);
        
        // Format reserves
        const formattedReserve0 = ethers.formatUnits(reserve0, token0Info.decimals);
        const formattedReserve1 = ethers.formatUnits(reserve1, token1Info.decimals);
        
        pairsWithLiquidity.push({
          pair,
          token0: token0Info,
          token1: token1Info,
          reserve0: formattedReserve0,
          reserve1: formattedReserve1
        });
        
        console.log(`Found pair with liquidity: ${token0Info.symbol}-${token1Info.symbol}`);
      } catch (error) {
        console.error(`Error checking pair ${i+1}/${events.length}:`, error.message);
      }
    }
    
    // Sort pairs by liquidity (prioritize pairs with WETH)
    pairsWithLiquidity.sort((a, b) => {
      const aHasWeth = a.token0.address.toLowerCase() === WETH_ADDRESS.toLowerCase() || 
                       a.token1.address.toLowerCase() === WETH_ADDRESS.toLowerCase();
      const bHasWeth = b.token0.address.toLowerCase() === WETH_ADDRESS.toLowerCase() || 
                       b.token1.address.toLowerCase() === WETH_ADDRESS.toLowerCase();
      
      if (aHasWeth && !bHasWeth) return -1;
      if (!aHasWeth && bHasWeth) return 1;
      return 0;
    });
    
    // Display results
    console.log(`\n✅ Found ${pairsWithLiquidity.length} pairs with liquidity:`);
    pairsWithLiquidity.forEach((pairInfo, index) => {
      console.log(`\n${index + 1}. Pair: ${pairInfo.pair}`);
      console.log(`   Tokens: ${pairInfo.token0.symbol} (${pairInfo.token0.address}) / ${pairInfo.token1.symbol} (${pairInfo.token1.address})`);
      console.log(`   Reserves: ${pairInfo.reserve0} ${pairInfo.token0.symbol} / ${pairInfo.reserve1} ${pairInfo.token1.symbol}`);
    });
    
    // Export token addresses to a file for easy reference
    const tokenAddresses = pairsWithLiquidity.reduce((acc, pair) => {
      if (!acc.includes(pair.token0.address)) {
        acc.push(pair.token0.address);
      }
      if (!acc.includes(pair.token1.address)) {
        acc.push(pair.token1.address);
      }
      return acc;
    }, []);
    
    console.log(`\nToken addresses with liquidity (${tokenAddresses.length}):`);
    tokenAddresses.forEach(address => {
      console.log(address);
    });
    
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
