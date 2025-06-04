// Import ethers directly instead of using hardhat
const { ethers } = require("ethers");
require("dotenv").config();

// ✅ Uniswap V2 Factory ABI (with PairCreated event)
const IUniswapV2FactoryABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

// ✅ Uniswap V2 Pair ABI (for checking reserves)
const IUniswapV2PairABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

// ✅ ERC20 Token ABI (for getting token info)
const IERC20ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

/**
 * Fetches events in chunks to avoid RPC provider limitations
 * @param {Contract} contract - The ethers contract to query
 * @param {object} eventFilter - Event filter to use
 * @param {number} fromBlock - Starting block
 * @param {number} toBlock - Ending block
 * @param {number} chunkSize - Size of each query chunk
 * @returns {Array} - Combined array of events
 */
async function getEventsInChunks(contract, eventFilter, fromBlock, toBlock, chunkSize = 500) {
  let allEvents = [];
  let currentFromBlock = fromBlock;
  
  while (currentFromBlock <= toBlock) {
    const currentToBlock = Math.min(currentFromBlock + chunkSize - 1, toBlock);
    console.log(`Querying blocks ${currentFromBlock} to ${currentToBlock}...`);
    
    try {
      const events = await contract.queryFilter(eventFilter, currentFromBlock, currentToBlock);
      allEvents = [...allEvents, ...events];
      console.log(`Found ${events.length} events in this chunk. Total so far: ${allEvents.length}`);
    } catch (error) {
      console.log(`Error querying blocks ${currentFromBlock} to ${currentToBlock}: ${error.message}`);
      // If the chunk size is too large, try with a smaller chunk
      if (chunkSize > 100 && (error.message.includes('range') || error.message.includes('block range'))) {
        const newChunkSize = Math.floor(chunkSize / 2);
        console.log(`Reducing chunk size to ${newChunkSize} and retrying...`);
        return getEventsInChunks(contract, eventFilter, fromBlock, toBlock, newChunkSize);
      }
    }
    
    currentFromBlock = currentToBlock + 1;
  }
  
  return allEvents;
}

async function main() {
  // ✅ Addresses for Sepolia testnet
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Uniswap V2 Factory (Sepolia)
  const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH Address on Sepolia
  
  // ✅ Using the provided Alchemy RPC URL for better performance
  const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/hCePbhV6Qbyp-WNXEi7VCkom47BCTjQp";
  console.log(`Using RPC URL: ${RPC_URL}`);
  
  // ✅ Create provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  console.log("🔍 Searching for pairs with WETH liquidity on Sepolia...");
  
  // ✅ Get Factory Contract
  const factory = new ethers.Contract(UNISWAP_FACTORY, IUniswapV2FactoryABI, provider);
  
  // ✅ Get the latest block number
  const latestBlock = await provider.getBlockNumber();
  console.log(`Current block: ${latestBlock}`);
  
  // ✅ Search for PairCreated events in the last 50,000 blocks (or adjust as needed)
  // Most public RPCs have a limit of 50,000 blocks per query
  const fromBlock = Math.max(0, latestBlock - 50000);
  console.log(`Searching from block ${fromBlock} to ${latestBlock}`);
  
  // ✅ Get all PairCreated events in chunks to avoid RPC limitations
  const pairCreatedFilter = factory.filters.PairCreated();
  const pairCreatedEvents = await getEventsInChunks(
    factory, 
    pairCreatedFilter, 
    fromBlock, 
    latestBlock, 
    10000 // chunk size of 10,000 blocks per query
  );
  
  console.log(`Found ${pairCreatedEvents.length} pairs created in total`);
  
  // ✅ Filter pairs that include WETH
  const wethPairs = pairCreatedEvents.filter(event => {
    const token0 = event.args[0].toLowerCase(); // token0
    const token1 = event.args[1].toLowerCase(); // token1
    return token0 === WETH_ADDRESS.toLowerCase() || token1 === WETH_ADDRESS.toLowerCase();
  });
  
  console.log(`Found ${wethPairs.length} pairs with WETH`);
  
  // ✅ Check liquidity for each pair
  const pairsWithLiquidity = [];
  
  for (const event of wethPairs) {
    const pairAddress = event.args[2]; // pair address
    const token0 = event.args[0]; // token0
    const token1 = event.args[1]; // token1
    
    // Determine which token is WETH and which is the other token
    const otherToken = token0.toLowerCase() === WETH_ADDRESS.toLowerCase() ? token1 : token0;
    const isToken0Weth = token0.toLowerCase() === WETH_ADDRESS.toLowerCase();
    
    try {
      // ✅ Get pair contract
      const pair = new ethers.Contract(pairAddress, IUniswapV2PairABI, provider);
      
      // ✅ Get reserves
      const reserves = await pair.getReserves();
      const wethReserve = isToken0Weth ? reserves[0] : reserves[1];
      const tokenReserve = isToken0Weth ? reserves[1] : reserves[0];
      
      // ✅ If there's some WETH liquidity (more than 0.01 WETH)
      if (Number(ethers.formatEther(wethReserve)) > 0.01) {
        try {
          // ✅ Get token info
          const token = new ethers.Contract(otherToken, IERC20ABI, provider);
          const name = await token.name();
          const symbol = await token.symbol();
          const decimals = await token.decimals();
          
          pairsWithLiquidity.push({
            pairAddress,
            tokenAddress: otherToken,
            name,
            symbol,
            wethLiquidity: ethers.formatEther(wethReserve),
            tokenLiquidity: ethers.formatUnits(tokenReserve, decimals)
          });
          
          console.log(`✅ Found pair with liquidity: ${symbol} - ${ethers.formatEther(wethReserve)} WETH`);
          
          // ✅ Stop after finding 20 pairs
          if (pairsWithLiquidity.length >= 20) {
            break;
          }
        } catch (error) {
          console.log(`❌ Error getting token info for ${otherToken}: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking pair ${pairAddress}: ${error.message}`);
    }
  }
  
  // ✅ Display results
  console.log("\n🔍 Found Tokens with WETH Liquidity on Sepolia:");
  console.log("=================================================");
  
  pairsWithLiquidity.forEach((pair, index) => {
    console.log(`${index + 1}. ${pair.symbol} (${pair.name})`);
    console.log(`   Token Address: ${pair.tokenAddress}`);
    console.log(`   Pair Address: ${pair.pairAddress}`);
    console.log(`   WETH Liquidity: ${pair.wethLiquidity} WETH`);
    console.log(`   Token Liquidity: ${pair.tokenLiquidity} ${pair.symbol}`);
    console.log("   -------------------------------------------------");
  });
  
  console.log(`\n✅ Total pairs with WETH liquidity found: ${pairsWithLiquidity.length}`);
  
  // Return the list for potential further use
  return pairsWithLiquidity;
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
