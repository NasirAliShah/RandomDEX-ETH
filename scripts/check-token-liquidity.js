const { ethers } = require("hardhat");

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
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

async function getTokenInfo(tokenAddress, provider) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const name = await tokenContract.name();
    const totalSupply = await tokenContract.totalSupply();
    return { symbol, decimals, name, totalSupply };
  } catch (error) {
    console.error(`Error getting token info for ${tokenAddress}:`, error.message);
    return { symbol: 'UNKNOWN', decimals: 18, name: 'Unknown Token', totalSupply: 0 };
  }
}

async function main() {
  try {
    // Default token address if not provided
    let tokenAddress = process.env.TOKEN_ADDRESS;
    
    if (!tokenAddress) {
      // Example token from our previous run
      tokenAddress = "0xFccCb96dD3E2A7349EF824D4431568dBf52015D7"; // MAK
      console.log("Using default token address (MAK)");
      console.log("To check another token, set the TOKEN_ADDRESS environment variable");
      console.log("Example: TOKEN_ADDRESS=0x... npx hardhat run scripts/check-token-liquidity.js --network baseSepolia");
    } else {
      console.log("Using token address from environment variable");
    }

    console.log(`Checking liquidity for token: ${tokenAddress}`);

    // Connect to the network
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    console.log("Connected to Base Sepolia testnet");
    
    // Get token info
    const tokenInfo = await getTokenInfo(tokenAddress, provider);
    const wethInfo = await getTokenInfo(WETH_ADDRESS, provider);
    
    console.log(`\nToken Information:`);
    console.log(`- Name: ${tokenInfo.name}`);
    console.log(`- Symbol: ${tokenInfo.symbol}`);
    console.log(`- Decimals: ${tokenInfo.decimals}`);
    console.log(`- Total Supply: ${ethers.formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)} ${tokenInfo.symbol}`);

    // Connect to the factory contract
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
    
    // Get the pair address
    const pairAddress = await factoryContract.getPair(tokenAddress, WETH_ADDRESS);
    
    console.log(`\nLiquidity Information:`);
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      console.log(`❌ No liquidity pair exists between ${tokenInfo.symbol} and WETH`);
      console.log(`\nTo create a liquidity pair, use the Uniswap V2 Router at: ${ROUTER_ADDRESS}`);
      return;
    }
    
    console.log(`✅ Found liquidity pair at address: ${pairAddress}`);
    
    // Connect to the pair contract
    const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
    
    // Get the reserves
    const [reserve0, reserve1, _] = await pairContract.getReserves();
    
    // Verify token order (Uniswap sorts tokens by address)
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();
    
    // Determine which reserve belongs to which token
    const tokenReserve = token0 === tokenAddress ? reserve0 : reserve1;
    const wethReserve = token0 === WETH_ADDRESS ? reserve0 : reserve1;
    
    // Format reserves based on decimals
    const formattedTokenReserve = ethers.formatUnits(tokenReserve, tokenInfo.decimals);
    const formattedWethReserve = ethers.formatUnits(wethReserve, wethInfo.decimals);
    
    console.log(`- Pair Contract: ${pairAddress}`);
    console.log(`- ${tokenInfo.symbol} Reserve: ${formattedTokenReserve} ${tokenInfo.symbol}`);
    console.log(`- WETH Reserve: ${formattedWethReserve} WETH`);
    
    // Calculate token price in ETH (safely convert BigInt to string first)
    const tokenReserveNum = parseFloat(ethers.formatUnits(tokenReserve, tokenInfo.decimals));
    const wethReserveNum = parseFloat(ethers.formatUnits(wethReserve, wethInfo.decimals));
    
    if (tokenReserveNum > 0) {
      const tokenPriceInEth = wethReserveNum / tokenReserveNum;
      console.log(`- Price: 1 ${tokenInfo.symbol} = ${tokenPriceInEth.toFixed(18)} ETH`);
    } else {
      console.log(`- Price: Cannot calculate (zero token reserve)`);
    }
    
    // Calculate total liquidity value in ETH
    const totalLiquidityInEth = wethReserveNum * 2;
    console.log(`- Total Liquidity Value: ~${totalLiquidityInEth.toFixed(4)} ETH`);
    
    console.log(`\nTo add more liquidity, use the Uniswap V2 Router at: ${ROUTER_ADDRESS}`);
    
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
