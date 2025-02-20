const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`🛠️ Removing liquidity for RandomDEXV2...`);

  // ✅ Uniswap V2 Router Address (Sepolia Testnet)
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

  // ✅ Replace with LP Token (Liquidity Pool) Address
  const LP_TOKEN_ADDRESS = "0x147359eA4D35f6D6c722c7c246bB79194443e9dE"; 

  // ✅ Replace with RDX Token Address
  const TOKEN_ADDRESS = "0xD25285eACBEf8F66f712Fb0fF0dF48b2756bbf7D"; 

  // ✅ WETH Address from Uniswap V2 Router
  const WETH_ADDRESS = await (await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER)).WETH();

  // ✅ Set deadline (10 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; 

  // ✅ Get Router & LP Token Contracts
  const router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
  const lpToken = await ethers.getContractAt("IERC20", LP_TOKEN_ADDRESS);

  // 1️⃣ Get LP Token Balance
  let lpBalance = await lpToken.balanceOf(deployer.address);
  console.log(`🔹 LP Token Balance: ${ethers.formatUnits(lpBalance, 18)}`);

  if (lpBalance == 0) {
    console.log("⚠️ No LP Tokens Found! Check Wallet Balance.");
    return;
  }

  // 2️⃣ Reduce LP Token Amount to Prevent Errors (99.99% of balance)
  let amountToRemove = lpBalance - (ethers.parseUnits("0.0001", 18)); 

  console.log(`🔹 Removing: ${ethers.formatUnits(amountToRemove, 18)} LP tokens`);

  // 3️⃣ Check & Approve LP Tokens for Uniswap Router
  let allowance = await lpToken.allowance(deployer.address, UNISWAP_ROUTER);
  console.log(`🔹 Current Allowance: ${ethers.formatUnits(allowance, 18)} LP Tokens`);

  if (allowance < amountToRemove) {
    console.log("✅ Approving LP Tokens for Uniswap...");
    const approveTx = await lpToken.approve(UNISWAP_ROUTER, lpBalance);
    await approveTx.wait();
    console.log("✅ Approval Confirmed.");
  }

  // 4️⃣ Verify Allowance Again
  allowance = await lpToken.allowance(deployer.address, UNISWAP_ROUTER);
  if (allowance< amountToRemove) {
    console.log("❌ Approval failed, cannot proceed.");
    return;
  }

  // 5️⃣ Remove Liquidity (Receive RDX + ETH)
  console.log(`⏳ Removing Liquidity...`);
  try {
    const removeTx = await router.removeLiquidity(
      TOKEN_ADDRESS,
      WETH_ADDRESS,
      amountToRemove,  // Remove 99.99% of LP tokens
      0,               // Min RDX tokens to receive
      0,               // Min ETH to receive
      deployer.address,
      deadline
    );

    await removeTx.wait();
    console.log("✅ Successfully removed liquidity!");

  } catch (error) {
    console.error("❌ Error Removing Liquidity:", error);
  }
}

main().catch((error) => {
  console.error("❌ Script Failed:", error);
  process.exit(1);
});
