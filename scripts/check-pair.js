const { ethers } = require("hardhat");

// ✅ Uniswap V2 Factory ABI (Minimal Required Functions)
const IUniswapV2FactoryABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

async function main() {
  const UNISWAP_FACTORY = "0xF62c03E08ada871A0bEb309762E260a7a6a880E6"; // Uniswap V2 Factory (Sepolia)
  const TOKEN_ADDRESS = "0x8F4E4345a81B02303cA7ccC8400c4cB8f2969fB5"; // Your Token Address
  const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH Address on Sepolia

  // ✅ Get Factory Contract using ABI
  const factory = new ethers.Contract(UNISWAP_FACTORY, IUniswapV2FactoryABI, ethers.provider);

  // ✅ Fetch the Pair Address
  const pairAddress = await factory.getPair(TOKEN_ADDRESS, WETH_ADDRESS);

  if (pairAddress === ethers.ZeroAddress) {
    console.log("❌ Pair does not exist! You need to add liquidity.");
  } else {
    console.log(`✅ Pair exists at: ${pairAddress}`);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
