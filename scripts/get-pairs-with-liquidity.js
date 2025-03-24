const { ethers } = require("hardhat");

// ✅ Uniswap V2 Factory ABI (Minimal Required Functions)
const factoryAddress = "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e"; // Base Testnet Factory
const factoryABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)"
];

// ERC20 Token ABI (for getting symbol and decimals)
const erc20ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)"
];

const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL); // Base Testnet RPC
const factoryContract = new ethers.Contract(factoryAddress, factoryABI, provider);

async function getPairs() {
    try {
        // Get current block number
        const currentBlock = await provider.getBlockNumber();
        console.log(`Current block number: ${currentBlock}`);
        
        // Look back further - 100,000 blocks or from block 0 if the chain is newer
        const fromBlock = Math.max(0, currentBlock - 100000);
        console.log(`Querying from block ${fromBlock} to ${currentBlock}`);
        
        const filter = factoryContract.filters.PairCreated();
        console.log('Fetching PairCreated events...');
        const events = await factoryContract.queryFilter(filter, fromBlock, currentBlock);
        console.log(`Found ${events.length} PairCreated events`);

        let pairs = [];
        for (const event of events) {
            try {
                const { token0, token1, pair } = event.args;
                pairs.push({ token0, token1, pair });
                console.log(`Found pair: ${pair} for tokens ${token0} and ${token1}`);
            } catch (error) {
                console.error(`Error processing event:`, error.message);
                console.log('Event:', event);
            }
        }

        console.log(`Found ${pairs.length} pairs`);
        return pairs;
    } catch (error) {
        console.error(`Error in getPairs:`, error.message);
        return [];
    }
}

getPairs().then(pairs => console.log(pairs)).catch(console.error);
const pairABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];
async function checkLiquidity(pairs) {
  let liquidPairs = [];
  console.log(`Checking liquidity for ${pairs.length} pairs...`);

  for (const { token0, token1, pair } of pairs) {
      const pairContract = new ethers.Contract(pair, pairABI, provider);

      try {
          console.log(`Checking pair ${pair}...`);
          const [reserve0, reserve1] = await pairContract.getReserves();
          console.log(`Pair ${pair}: Reserve0: ${ethers.formatEther(reserve0)}, Reserve1: ${ethers.formatEther(reserve1)}`);

          // Check if liquidity is above a threshold (e.g., 0.1 ETH worth - lowered threshold for testnet)
          if (reserve0 > ethers.parseEther("0.1") || reserve1 > ethers.parseEther("0.1")) {
              liquidPairs.push({ 
                token0, 
                token1, 
                pair, 
                reserve0: ethers.formatEther(reserve0), 
                reserve1: ethers.formatEther(reserve1) 
              });
              console.log(`✅ Added pair with sufficient liquidity: ${pair}`);
          } else {
              console.log(`❌ Insufficient liquidity in pair: ${pair}`);
          }

          if (liquidPairs.length >= 20) {
              console.log('Reached 20 pairs with liquidity, stopping search.');
              break; // Stop if we get 20 pairs
          }
      } catch (error) {
          console.error(`Error checking liquidity for pair ${pair}:`, error.message);
      }
  }

  console.log(`Found ${liquidPairs.length} pairs with sufficient liquidity`);
  return liquidPairs;
}
// Get token symbol and decimals
async function getTokenInfo(tokenAddress) {
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

async function getTopLiquidTokens() {
  try {
    const pairs = await getPairs();
    const liquidPairs = await checkLiquidity(pairs);
    
    // Enhance with token info
    const enhancedPairs = [];
    for (const pair of liquidPairs) {
      try {
        console.log(`Getting token info for ${pair.token0} and ${pair.token1}...`);
        const token0Info = await getTokenInfo(pair.token0);
        const token1Info = await getTokenInfo(pair.token1);
        
        enhancedPairs.push({
          ...pair,
          token0Symbol: token0Info.symbol,
          token1Symbol: token1Info.symbol,
          token0Name: token0Info.name,
          token1Name: token1Info.name
        });
      } catch (error) {
        console.error(`Error enhancing pair info:`, error.message);
        enhancedPairs.push(pair);
      }
    }
    
    console.log(`\n✅ Top ${enhancedPairs.length} Tokens with Liquidity:`);
    enhancedPairs.forEach((pair, index) => {
      console.log(`${index + 1}. Pair: ${pair.pair}`);
      console.log(`   Token0: ${pair.token0Symbol} (${pair.token0})`);
      console.log(`   Token1: ${pair.token1Symbol} (${pair.token1})`);
      console.log(`   Reserves: ${pair.reserve0} ${pair.token0Symbol} / ${pair.reserve1} ${pair.token1Symbol}\n`);
    });
    
    return enhancedPairs;
  } catch (error) {
    console.error(`Error getting top liquid tokens:`, error);
    return [];
  }
}

getTopLiquidTokens().catch(console.error);
