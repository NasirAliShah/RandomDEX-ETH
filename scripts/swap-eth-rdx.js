const { ethers } = require("hardhat");

async function main() {
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Uniswap V2 Router (Sepolia)
  const RDX_TOKEN = "0x8F4E4345a81B02303cA7ccC8400c4cB8f2969fB5"; // RDX Token Address
  const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH Address on Sepolia
  const [user] = await ethers.getSigners();

  const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  
  const amountInETH = ethers.parseUnits("0.01", 18); // Swap 0.01 ETH for RDX
  const amountOutMin = 0; // Accept any amount of RDX (set slippage accordingly)
  const path = [WETH_ADDRESS, RDX_TOKEN];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now

  console.log(`🔄 Swapping ${ethers.formatUnits(amountInETH, 18)} ETH for RDX...`);

  const swapTx = await router.swapExactETHForTokens(
    amountOutMin,
    path,
    user.address, // Receive RDX in your wallet
    deadline,
    { value: amountInETH } // Send ETH
  );

  await swapTx.wait();
  console.log("✅ Swap Successful! Check RDX balance.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
