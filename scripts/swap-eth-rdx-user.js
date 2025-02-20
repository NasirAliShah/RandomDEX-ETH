const { ethers } = require("hardhat");

async function main() {
  const accounts = await ethers.getSigners(); // Get all accounts
  const secondAccount = accounts[1]; // Use second account
  console.log(`🔹 Swapping from: ${secondAccount.address}`);

  // ✅ Uniswap V2 Router & Token Addresses (Sepolia Testnet)
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";
  const RDX_TOKEN = "0x8F4E4345a81B02303cA7ccC8400c4cB8f2969fB5"; 
  const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; 

  const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER, secondAccount);
  const rdxToken = await ethers.getContractAt("IERC20", RDX_TOKEN, secondAccount);

  // ✅ Amount to swap (2 RDX)
  const amountIn = ethers.parseUnits("2", 18);
  const amountOutMin = 0; // Accept any amount of ETH
  const path = [RDX_TOKEN, WETH_ADDRESS];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now

  // 🔍 Check balance of second account
  const balance = await rdxToken.balanceOf(secondAccount.address);
  console.log(`🔹 RDX Balance: ${ethers.formatUnits(balance, 18)}`);
  if (balance < amountIn) {
    console.log("❌ Not enough RDX balance to swap.");
    return;
  }

  // 🔍 Check allowance of Uniswap Router
  const allowance = await rdxToken.allowance(secondAccount.address, UNISWAP_ROUTER);
  console.log(`🔹 Current Allowance: ${ethers.formatUnits(allowance, 18)}`);

  if (allowance < amountIn) {
    console.log("⏳ Approving Uniswap Router to spend RDX...");
    const approveTx = await rdxToken.approve(UNISWAP_ROUTER, amountIn);
    await approveTx.wait();
    console.log("✅ Approval confirmed!");
  }

  console.log(`🔄 Swapping ${ethers.formatUnits(amountIn, 18)} RDX for ETH...`);

  // ✅ Perform swap
  const swapTx = await router.swapExactTokensForETH(
    amountIn,
    amountOutMin,
    path,
    secondAccount.address, // Receive ETH in this account
    deadline
  );

  await swapTx.wait();
  console.log("✅ Swap Successful! Check second account's ETH balance.");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
