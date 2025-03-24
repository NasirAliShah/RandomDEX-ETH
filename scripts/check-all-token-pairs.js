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
    // Default token address if not provided
    let tokenAddress = process.env.TOKEN_ADDRESS;
    
    if (!tokenAddress) {
      // Example token from our previous run
      tokenAddress = "0x4200000000000000000000000000000000000006"; // WETH
      console.log("Using default token address (WETH)");
      console.log("To check another token, set the TOKEN_ADDRESS environment variable");
      console.log("Example: TOKEN_ADDRESS=0x... npx hardhat run scripts/check-all-token-pairs.js --network baseSepolia");
    } else {
      console.log("Using token address from environment variable");
    }

    console.log(`Checking all liquidity pairs for token: ${tokenAddress}`);

    // Connect to the network
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    console.log("Connected to Base Sepolia testnet");
    
    // Get token info
    const tokenInfo = await getTokenInfo(tokenAddress, provider);
    
    console.log(`\nToken Information:`);
    console.log(`- Name: ${tokenInfo.name}`);
    console.log(`- Symbol: ${tokenInfo.symbol}`);
    console.log(`- Address: ${tokenInfo.address}`);

    // Connect to the factory contract
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);
    
    // Look back further - 100,000 blocks or from block 0 if the chain is newer
    const fromBlock = Math.max(0, currentBlock - 100000);
    console.log(`Querying from block ${fromBlock} to ${currentBlock}`);
    
    // Get all PairCreated events
    const filter = factoryContract.filters.PairCreated();
    console.log('Fetching PairCreated events...');
    const events = await factoryContract.queryFilter(filter, fromBlock, currentBlock);
    console.log(`Found ${events.length} PairCreated events`);

    // Filter events for pairs containing our token
    const relevantPairs = [];
    for (const event of events) {
      try {
        const { token0, token1, pair } = event.args;
        if (token0.toLowerCase() === tokenAddress.toLowerCase() || 
            token1.toLowerCase() === tokenAddress.toLowerCase()) {
          relevantPairs.push({ token0, token1, pair });
        }
      } catch (error) {
        console.error(`Error processing event:`, error.message);
      }
    }
    
    console.log(`\nFound ${relevantPairs.length} pairs containing ${tokenInfo.symbol}`);
    
    if (relevantPairs.length === 0) {
      console.log(`No liquidity pairs found for ${tokenInfo.symbol}`);
      return;
    }
    
    // Check liquidity for each pair
    const pairsWithLiquidity = [];
    
    for (const { token0, token1, pair } of relevantPairs) {
      try {
        // Get the other token in the pair
        const otherTokenAddress = token0.toLowerCase() === tokenAddress.toLowerCase() ? token1 : token0;
        const otherTokenInfo = await getTokenInfo(otherTokenAddress, provider);
        
        // Get pair info
        const pairContract = new ethers.Contract(pair, pairABI, provider);
        const [reserve0, reserve1] = await pairContract.getReserves();
        
        // Determine which reserve belongs to which token
        const actualToken0 = await pairContract.token0();
        const tokenReserve = actualToken0.toLowerCase() === tokenAddress.toLowerCase() ? reserve0 : reserve1;
        const otherTokenReserve = actualToken0.toLowerCase() === tokenAddress.toLowerCase() ? reserve1 : reserve0;
        
        // Format reserves
        const formattedTokenReserve = ethers.formatUnits(tokenReserve, tokenInfo.decimals);
        const formattedOtherTokenReserve = ethers.formatUnits(otherTokenReserve, otherTokenInfo.decimals);
        
        pairsWithLiquidity.push({
          pair,
          otherToken: otherTokenInfo,
          tokenReserve: formattedTokenReserve,
          otherTokenReserve: formattedOtherTokenReserve
        });
      } catch (error) {
        console.error(`Error checking liquidity for pair ${pair}:`, error.message);
      }
    }
    
    // Sort pairs by liquidity (token reserve)
    pairsWithLiquidity.sort((a, b) => parseFloat(b.tokenReserve) - parseFloat(a.tokenReserve));
    
    // Display results
    console.log(`\n✅ ${pairsWithLiquidity.length} Liquidity Pairs for ${tokenInfo.symbol}:`);
    pairsWithLiquidity.forEach((pairInfo, index) => {
      console.log(`\n${index + 1}. Pair: ${pairInfo.pair}`);
      console.log(`   Paired with: ${pairInfo.otherToken.symbol} (${pairInfo.otherToken.name})`);
      console.log(`   Address: ${pairInfo.otherToken.address}`);
      console.log(`   Reserves: ${pairInfo.tokenReserve} ${tokenInfo.symbol} / ${pairInfo.otherTokenReserve} ${pairInfo.otherToken.symbol}`);
      
      // Calculate price if other token is WETH
      if (pairInfo.otherToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        const tokenPriceInEth = parseFloat(pairInfo.otherTokenReserve) / parseFloat(pairInfo.tokenReserve);
        console.log(`   Price: 1 ${tokenInfo.symbol} = ${tokenPriceInEth.toFixed(18)} ETH`);
      }
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
