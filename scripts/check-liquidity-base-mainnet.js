const hre = require("hardhat");
require("dotenv").config();

// Base Mainnet DEX addresses (Aerodrome)
const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da"; // Aerodrome Factory
const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"; // Aerodrome Router
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base

// List of token addresses and tickers to check on Base mainnet
const tokens = [
    { ticker: "Virtual", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b" },
    { ticker: "EAI", address: "0x6797B6244fA75F2e78cDFfC3a4eb169332b730cc" },
    { ticker: "BRETT", address: "0x532f27101965dd16442E59d40670FaF5eBB142E4" },
    { ticker: "CLIZA", address: "0x290f057A2C59b95D8027aa4Abf31782676502071" },
    { ticker: "TOSHI", address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4" },
    { ticker: "PAID", address: "0x655A51e6803faF50D4acE80fa501af2F29C856cF" },
    { ticker: "IMO", address: "0x5a7a2bf9ffae199f088b25837dcd7e115cf8e1bb" },
    { ticker: "PRIME", address: "0xfa980ced6895ac314e7de34ef1bfae90a5add21b" },
    { ticker: "AERO", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" },
    { ticker: "WELL", address: "0xA88594D404727625A9437C3f886C7643872296AE" },
    { ticker: "MIGGLES", address: "0xB1a03EdA10342529bBF8EB700a06C60441fEf25d" },
    { ticker: "BID", address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b" },
    { ticker: "KAITO", address: "0x98d0baa52b2d063e780de12f615f963fe8537553" }
];

async function main() {
    try {
        // Connect to the network
        const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_MAINNET_RPC_URL);
        console.log("Connected to Base mainnet");
        
        // Get the current block
        const blockNumber = await provider.getBlockNumber();
        console.log(`Current block: ${blockNumber}`);
        
        // Aerodrome Factory ABI - note: Aerodrome uses a different function name
        const factoryABI = [
            "function getPool(address tokenA, address tokenB, bool stable) external view returns (address pool)"
        ];
        
        // Aerodrome Pool ABI
        const poolABI = [
            "function getReserves() external view returns (uint256 _reserve0, uint256 _reserve1, uint256 _blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)",
            "function stable() external view returns (bool)"
        ];
        
        // ERC20 ABI for token info
        const erc20ABI = [
            "function name() external view returns (string)",
            "function symbol() external view returns (string)",
            "function decimals() external view returns (uint8)"
        ];
        
        // Initialize factory contract
        const factory = new hre.ethers.Contract(AERODROME_FACTORY, factoryABI, provider);
        
        console.log("\n=== CHECKING LIQUIDITY FOR TOKENS ON BASE MAINNET (AERODROME) ===");
        console.log("Aerodrome Factory:", AERODROME_FACTORY);
        console.log("WETH Address:", WETH_ADDRESS);
        console.log("======================================\n");
        
        // Check each token
        for (const token of tokens) {
            try {
                console.log(`\nChecking ${token.ticker} (${token.address})...`);
                
                // Get token info
                const tokenContract = new hre.ethers.Contract(token.address, erc20ABI, provider);
                let tokenName, tokenSymbol, tokenDecimals;
                
                try {
                    [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
                        tokenContract.name(),
                        tokenContract.symbol(),
                        tokenContract.decimals()
                    ]);
                    console.log(`Token Info: ${tokenName} (${tokenSymbol}), Decimals: ${tokenDecimals}`);
                } catch (error) {
                    console.log(`Could not get token info: ${error.message}`);
                    tokenDecimals = 18; // Default to 18 decimals if we can't get the actual value
                }
                
                // Check both volatile and stable pools
                const poolTypes = [
                    { type: "Volatile", stable: false },
                    { type: "Stable", stable: true }
                ];
                
                let foundPool = false;
                
                for (const poolType of poolTypes) {
                    try {
                        // Get pool address - Aerodrome uses getPool instead of getPair
                        const poolAddress = await factory.getPool(token.address, WETH_ADDRESS, poolType.stable);
                        
                        if (poolAddress === "0x0000000000000000000000000000000000000000") {
                            console.log(`No ${poolType.type} pool exists for ${token.ticker} and WETH`);
                            continue;
                        }
                        
                        foundPool = true;
                        console.log(`\n✅ FOUND ${poolType.type.toUpperCase()} POOL:`);
                        console.log(`Pool Address: ${poolAddress}`);
                        
                        // Get pool contract
                        const poolContract = new hre.ethers.Contract(poolAddress, poolABI, provider);
                        
                        // Get token order in the pool
                        const [token0, token1, reserves] = await Promise.all([
                            poolContract.token0(),
                            poolContract.token1(),
                            poolContract.getReserves()
                        ]);
                        
                        // Determine which reserve is the token and which is WETH
                        let tokenReserve, wethReserve;
                        if (token0.toLowerCase() === token.address.toLowerCase()) {
                            tokenReserve = reserves[0];
                            wethReserve = reserves[1];
                            console.log(`Token is token0 in the pool`);
                        } else {
                            tokenReserve = reserves[1];
                            wethReserve = reserves[0];
                            console.log(`Token is token1 in the pool`);
                        }
                        
                        // Format reserves with proper decimals
                        const formattedTokenReserve = hre.ethers.formatUnits(tokenReserve, tokenDecimals);
                        const formattedWethReserve = hre.ethers.formatEther(wethReserve);
                        
                        console.log(`- Token Reserve: ${formattedTokenReserve} ${tokenSymbol || token.ticker}`);
                        console.log(`- WETH Reserve: ${formattedWethReserve} WETH`);
                        
                        // Calculate token price in ETH
                        if (tokenReserve > 0n) {
                            // Price calculation: wethReserve / tokenReserve
                            const priceInEth = Number(formattedWethReserve) / Number(formattedTokenReserve);
                            console.log(`- Price: 1 ${tokenSymbol || token.ticker} = ${priceInEth.toFixed(18)} ETH`);
                            
                            // Calculate total liquidity value in USD (assuming ETH price of $3,000)
                            const ethPrice = 3000; // Approximate ETH price in USD
                            const liquidityValueInUsd = Number(formattedWethReserve) * 2 * ethPrice;
                            console.log(`- Total Liquidity Value: ~$${liquidityValueInUsd.toLocaleString()} (estimated)`);
                        } else {
                            console.log(`- Price: Cannot calculate (zero token reserve)`);
                        }
                    } catch (error) {
                        console.log(`Error checking ${poolType.type} pool: ${error.message}`);
                    }
                }
                
                if (!foundPool) {
                    console.log(`❌ NO LIQUIDITY: No Aerodrome pools exist for ${token.ticker} and WETH`);
                }
                
            } catch (error) {
                console.log(`❌ ERROR checking ${token.ticker}: ${error.message}`);
            }
        }
        
        // Also check BaseSwap as a fallback
        console.log("\n\n=== CHECKING BASESWAP AS FALLBACK ===");
        const BASESWAP_FACTORY = "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB";
        
        // BaseSwap Factory ABI (standard Uniswap V2 style)
        const baseswapFactoryABI = [
            "function getPair(address tokenA, address tokenB) external view returns (address pair)"
        ];
        
        // Standard Pair ABI
        const pairABI = [
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
        ];
        
        const baseswapFactory = new hre.ethers.Contract(BASESWAP_FACTORY, baseswapFactoryABI, provider);
        
        for (const token of tokens) {
            try {
                // Skip tokens that already had liquidity on Aerodrome
                if (token.hasLiquidity) continue;
                
                const pairAddress = await baseswapFactory.getPair(token.address, WETH_ADDRESS);
                
                if (pairAddress === "0x0000000000000000000000000000000000000000") {
                    continue;
                }
                
                console.log(`\n✅ FOUND BASESWAP PAIR for ${token.ticker}:`);
                console.log(`Pair Address: ${pairAddress}`);
                
                // Get token info if we don't have it
                let tokenDecimals = 18;
                let tokenSymbol = token.ticker;
                
                if (!token.decimals) {
                    try {
                        const tokenContract = new hre.ethers.Contract(token.address, erc20ABI, provider);
                        tokenDecimals = await tokenContract.decimals();
                        tokenSymbol = await tokenContract.symbol();
                    } catch (error) {
                        console.log(`Could not get token info: ${error.message}`);
                    }
                }
                
                // Get pair contract
                const pairContract = new hre.ethers.Contract(pairAddress, pairABI, provider);
                
                // Get token order in the pair
                const [token0, token1, reserves] = await Promise.all([
                    pairContract.token0(),
                    pairContract.token1(),
                    pairContract.getReserves()
                ]);
                
                // Determine which reserve is the token and which is WETH
                let tokenReserve, wethReserve;
                if (token0.toLowerCase() === token.address.toLowerCase()) {
                    tokenReserve = reserves[0];
                    wethReserve = reserves[1];
                } else {
                    tokenReserve = reserves[1];
                    wethReserve = reserves[0];
                }
                
                // Format reserves with proper decimals
                const formattedTokenReserve = hre.ethers.formatUnits(tokenReserve, tokenDecimals);
                const formattedWethReserve = hre.ethers.formatEther(wethReserve);
                
                console.log(`- Token Reserve: ${formattedTokenReserve} ${tokenSymbol}`);
                console.log(`- WETH Reserve: ${formattedWethReserve} WETH`);
                
                // Calculate token price in ETH
                if (tokenReserve > 0n) {
                    const priceInEth = Number(formattedWethReserve) / Number(formattedTokenReserve);
                    console.log(`- Price: 1 ${tokenSymbol} = ${priceInEth.toFixed(18)} ETH`);
                }
                
            } catch (error) {
                // Just skip silently for BaseSwap fallback check
            }
        }
        
    } catch (error) {
        console.error("Fatal error:", error);
    }
}

// Execute the main function
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Unhandled error:", error);
        process.exit(1);
    });
