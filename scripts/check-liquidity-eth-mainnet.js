const hre = require("hardhat");
require("dotenv").config();

// Uniswap V2 Factory and Router addresses on Ethereum mainnet
const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

// List of token addresses and tickers to check
const tokens = [
    { ticker: "APES", address: "0x09675e24CA1EB06023451AC8088EcA1040F47585" },
    { ticker: "ALVA", address: "0x8e729198d1C59B82bd6bBa579310C40d740A11C2" },
    { ticker: "BERRY", address: "0xCb76314C2540199f4B844D4ebbC7998C604880cA" },
    { ticker: "SEN", address: "0x421b05cf5ce28Cb7347E73e2278E84472F0E4a88" },
    { ticker: "CTRL", address: "0xb28a3778e1A78a8c327693516ed4F5B11db41306" },
    { ticker: "BUBSY", address: "0xD699B83e43415B774B6ed4ce9999680F049aF2ab" },
    { ticker: "GURU", address: "0xaA7D24c3E14491aBaC746a98751A4883E9b70843" },
    { ticker: "CHAT", address: "0xBb3D7F42C58Abd83616Ad7C8C72473Ee46df2678" },
    { ticker: "COR", address: "0x8e0eef788350f40255d86dfe8d91ec0ad3a4547f" },
    { ticker: "GPU", address: "0x1258D60B224c0C5cD888D37bbF31aa5FCFb7e870" },
    { ticker: "RAI", address: "0xc575BD129848Ce06A460A19466c30E1D0328F52C" },
    { ticker: "XMW", address: "0x391cF4b21F557c935C7f670218Ef42C21bd8d686" },
    { ticker: "OCEAN", address: "0x967da4048cd07ab37855c090aaf366e4ce1b9f48" },
    { ticker: "SPECTRE", address: "0x9cf0ed013e67db12ca3af8e7506fe401aa14dad6" },
    { ticker: "PALM", address: "0xf1df7305E4BAB3885caB5B1e4dFC338452a67891" },
    { ticker: "MICRO", address: "0x8CEDb0680531d26e62ABdBd0F4c5428b7fDC26d5" },
    { ticker: "EVA", address: "0x3566C8eE9780245e974e759a7716EA6BA0702588" },
    { ticker: "M87", address: "0x80122c6a83C8202Ea365233363d3f4837D13e888" },
    { ticker: "QF", address: "0x6019Dcb2d0b3E0d1D8B0cE8D16191b3A4f93703d" }
];

async function main() {
    try {
        // Connect to the network
        const provider = new hre.ethers.JsonRpcProvider(process.env.ETH_MAINNET_RPC_URL);
        console.log("Connected to Ethereum mainnet");
        
        // Get the current block
        const blockNumber = await provider.getBlockNumber();
        console.log(`Current block: ${blockNumber}`);
        
        // Factory ABI for getPair function
        const factoryABI = [
            "function getPair(address tokenA, address tokenB) external view returns (address pair)"
        ];
        
        // Pair ABI for getReserves function
        const pairABI = [
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
        ];
        
        // ERC20 ABI for token info
        const erc20ABI = [
            "function name() external view returns (string)",
            "function symbol() external view returns (string)",
            "function decimals() external view returns (uint8)"
        ];
        
        // Initialize factory contract
        const factory = new hre.ethers.Contract(UNISWAP_V2_FACTORY, factoryABI, provider);
        
        console.log("\n=== CHECKING LIQUIDITY FOR TOKENS ===");
        console.log("Uniswap V2 Factory:", UNISWAP_V2_FACTORY);
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
                
                // Get pair address
                const pairAddress = await factory.getPair(token.address, WETH_ADDRESS);
                
                if (pairAddress === "0x0000000000000000000000000000000000000000") {
                    console.log(`❌ NO LIQUIDITY: No Uniswap V2 pair exists for ${token.ticker} and WETH`);
                    continue;
                }
                
                console.log(`Pair Address: ${pairAddress}`);
                
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
                    console.log(`Token is token0 in the pair`);
                } else {
                    tokenReserve = reserves[1];
                    wethReserve = reserves[0];
                    console.log(`Token is token1 in the pair`);
                }
                
                // Format reserves with proper decimals
                const formattedTokenReserve = hre.ethers.formatUnits(tokenReserve, tokenDecimals);
                const formattedWethReserve = hre.ethers.formatEther(wethReserve);
                
                console.log(`✅ HAS LIQUIDITY:`);
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
                console.log(`❌ ERROR checking ${token.ticker}: ${error.message}`);
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
