const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`🛠️ Removing liquidity for RandomDEXV2...`);
  
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Uniswap V2 Router (Sepolia)
  const LP_TOKEN_ADDRESS = "0x147359eA4D35f6D6c722c7c246bB79194443e9dE"; // Your LP token address
  const TOKEN_ADDRESS = "0xD25285eACBEf8F66f712Fb0fF0dF48b2756bbf7D"; // Your RDXV2 token address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now

  const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  const lpToken = await ethers.getContractAt("IERC20", LP_TOKEN_ADDRESS);

  // 1️⃣ Get LP Token Balance
  let lpBalance = await lpToken.balanceOf(deployer.address);
  console.log(`🔹 LP Token Balance (Before Approval): ${ethers.formatUnits(lpBalance, 18)}`);

  if (lpBalance == 0) {
    console.log("⚠️ No LP Tokens Found! Check Wallet Balance.");
    return;
  }

  // 2️⃣ Approve Router to Spend LP Tokens
  console.log("✅ Approving LP Tokens for Uniswap...");
  const approveTx = await lpToken.approve(UNISWAP_ROUTER, lpBalance);
  await approveTx.wait();

  // 3️⃣ Confirm Approval Worked
  let allowance = await lpToken.allowance(deployer.address, UNISWAP_ROUTER);
  console.log(`🔹 Allowance Given: ${ethers.formatUnits(allowance, 18)} LP Tokens`);

  if (allowance < lpBalance) {
    console.log("⚠️ Approval failed, cannot proceed.");
    return;
  }

  // 4️⃣ Remove Liquidity
  console.log(`⏳ Removing Liquidity...`);
  const removeTx = await router.removeLiquidityETH(
    TOKEN_ADDRESS,
    lpBalance,  // Remove all LP tokens
    0,          // Min RDX tokens to receive
    0,          // Min ETH to receive
    deployer.address,
    deadline
  );

  await removeTx.wait();
  console.log("✅ Successfully removed liquidity!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
