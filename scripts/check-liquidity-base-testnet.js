const hre = require("hardhat");
require("dotenv").config();

// Base Testnet DEX addresses
const UNISWAP_V2_FACTORY = "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e"; // Uniswap V2 Factory on Base testnet
const UNISWAP_V2_ROUTER = "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602"; // Uniswap V2 Router on Base testnet
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base testnet

// List of token addresses and tickers to check on Base testnet
const tokens = [
    { ticker: "Neiro", address: "0x5EdF9324539DaF9dFeff8E15c8A8ce813968C08e" },
    { ticker: "Pottorium", address: "0x20ACD00818d66A4C3Cbe2E45527e8407C2336900" },
    { ticker: "TestToken", address: "0x64995679700492099f8e49169d8ec87d5ddca9bd" },
    { ticker: "KitchenToken", address: "0x3b41fcb10a47c48e681f28e93b52d20f6838d9ab" },
    { ticker: "tDai", address: "0x8fd15157bc69c4a6d7994aa8876b046167e24c96" },
    { ticker: "Doge", address: "0x1968F94F0477dd12E49012688F6602DF71907c1A" },
    { ticker: "Mak", address: "0xFccCb96dD3E2A7349EF824D4431568dBf52015D7" },
    { ticker: "ACT", address: "0x412048443c4E4C0D98b8728Ef613aF955cD77e11" },
    { ticker: "AME", address: "0x1E7285DBd7826Ce2C91D32aC17261daba26a74B7" },
    { ticker: "TESTING95", address: "0x79d637AcD2f16a3b3B91101bd55e6c61dbbEb630" },
    { ticker: "FAN", address: "0x9033555208Be1e02a674e3Ec85d63E4F7DCB9009" },
    { ticker: "SSSSS", address: "0xA011989Ad9D59E5a8Fbf5AE656719A61b8972F4F" },
    { ticker: "VILLAG", address: "0x6BB79a771CFaF6A356c54194CaE51EEA136b31a2" },
    { ticker: "CPY", address: "0xD54A4ecD26ad6589C7F142213a82954E65655C3C" },
    { ticker: "BB", address: "0x7C6EF350A252435c2356ee9A6fd2530B9CcD8729" },
    { ticker: "HYPER", address: "0xa9560A3E0Bfb66ad071c7a14702C7BcEeC3AE465" },
    { ticker: "MONKEY", address: "0xabB5115c281b00db56369AEF07DD6CA6fad2D6D9" },
    { ticker: "CAT", address: "0x28Ea0a65B4B457B926aD5Af6Fa670D003C3d22F0" },
    { ticker: "AAA", address: "0x6eB8DB56a9BCc6d2ea4D350a8e916aD824F4BFaa" },
    { ticker: "NT1", address: "0xa2414Fc79472A0ecBd9656b66B3e3884C7ee1638" },
    { ticker: "NT2", address: "0xA8BBd6b7C903189eba13aa0f43A780ee19Fa69C9" }
];

async function main() {
    try {
        // Connect to the network
        const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
        console.log("Connected to Base testnet");
        
        // Get the current block
        const blockNumber = await provider.getBlockNumber();
        console.log(`Current block: ${blockNumber}`);
        
        // ABIs
        const erc20ABI = [
            "function name() external view returns (string)",
            "function symbol() external view returns (string)",
            "function decimals() external view returns (uint8)"
        ];
        
        // Uniswap V2 Factory ABI
        const uniswapFactoryABI = [
            "function getPair(address tokenA, address tokenB) external view returns (address pair)"
        ];
        
        // Uniswap V2 Pair ABI
        const uniswapPairABI = [
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
        ];
        
        // Initialize Uniswap factory contract
        const uniswapFactory = new hre.ethers.Contract(UNISWAP_V2_FACTORY, uniswapFactoryABI, provider);
        
        console.log("\n=== CHECKING WETH LIQUIDITY FOR TOKENS ON BASE TESTNET ===");
        console.log("WETH Address:", WETH_ADDRESS);
        console.log("======================================\n");
        
        // Create a table for results
        console.log("| Token | Address | Has Liquidity | Pool Address | Token Reserve | WETH Reserve | Price (1 Token in ETH) |");
        console.log("|-------|---------|---------------|--------------|---------------|--------------|------------------------|");
        
        // Check each token
        for (const token of tokens) {
            try {
                // Get token info
                const tokenContract = new hre.ethers.Contract(token.address, erc20ABI, provider);
                let tokenName, tokenSymbol, tokenDecimals;
                
                try {
                    [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
                        tokenContract.name(),
                        tokenContract.symbol(),
                        tokenContract.decimals()
                    ]);
                } catch (error) {
                    console.log(`Could not get token info for ${token.ticker}: ${error.message}`);
                    tokenName = token.ticker;
                    tokenSymbol = token.ticker;
                    tokenDecimals = 18; // Default to 18 decimals if we can't get the actual value
                }
                
                // Check for Uniswap pair
                const pairAddress = await uniswapFactory.getPair(token.address, WETH_ADDRESS);
                
                if (pairAddress === "0x0000000000000000000000000000000000000000") {
                    console.log(`| ${tokenSymbol.padEnd(5)} | ${token.address.slice(0, 8)}...${token.address.slice(-6)} | ❌ No | - | - | - | - |`);
                    continue;
                }
                
                // Get pair contract
                const pairContract = new hre.ethers.Contract(pairAddress, uniswapPairABI, provider);
                
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
                
                // Calculate token price in ETH
                let priceInEth = "N/A";
                if (tokenReserve > 0n) {
                    priceInEth = (Number(formattedWethReserve) / Number(formattedTokenReserve)).toFixed(10);
                }
                
                console.log(`| ${tokenSymbol.padEnd(5)} | ${token.address.slice(0, 8)}...${token.address.slice(-6)} | ✅ Yes | ${pairAddress.slice(0, 8)}...${pairAddress.slice(-6)} | ${Number(formattedTokenReserve).toFixed(6).padEnd(13)} | ${Number(formattedWethReserve).toFixed(6).padEnd(12)} | ${priceInEth.padEnd(22)} |`);
                
                // Save detailed information for later output
                token.hasLiquidity = true;
                token.pairAddress = pairAddress;
                token.tokenReserve = formattedTokenReserve;
                token.wethReserve = formattedWethReserve;
                token.priceInEth = priceInEth;
                token.symbol = tokenSymbol;
                token.name = tokenName;
                
            } catch (error) {
                console.log(`| ${token.ticker.padEnd(5)} | ${token.address.slice(0, 8)}...${token.address.slice(-6)} | ❌ Error | - | - | - | ${error.message.slice(0, 20)} |`);
            }
        }
        
        // Detailed output for tokens with liquidity
        console.log("\n\n=== DETAILED LIQUIDITY INFORMATION ===");
        
        const tokensWithLiquidity = tokens.filter(t => t.hasLiquidity);
        
        if (tokensWithLiquidity.length === 0) {
            console.log("No tokens have liquidity with WETH");
        } else {
            for (const token of tokensWithLiquidity) {
                console.log(`\n${token.name} (${token.symbol})`);
                console.log(`Address: ${token.address}`);
                console.log(`Pair Address: ${token.pairAddress}`);
                console.log(`Token Reserve: ${token.tokenReserve} ${token.symbol}`);
                console.log(`WETH Reserve: ${token.wethReserve} WETH`);
                console.log(`Price: 1 ${token.symbol} = ${token.priceInEth} ETH`);
                
                // Calculate total liquidity value in USD (assuming ETH price of $3,000)
                const ethPrice = 3000; // Approximate ETH price in USD
                const liquidityValueInUsd = Number(token.wethReserve) * 2 * ethPrice;
                console.log(`Total Liquidity Value: ~$${liquidityValueInUsd.toLocaleString()} (estimated)`);
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
