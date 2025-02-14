const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Approving Uniswap Router to spend LP tokens...");

  const LP_TOKEN_ADDRESS = "0x147359eA4D35f6D6c722c7c246bB79194443e9dE"; // Replace with your LP token address
  const UNISWAP_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Uniswap V2 Router (Sepolia)

  const lpToken = await ethers.getContractAt("IERC20", LP_TOKEN_ADDRESS);
  const approveTx = await lpToken.approve(UNISWAP_ROUTER, ethers.parseUnits("1000000", 18));
  await approveTx.wait();

  console.log("✅ Approved Uniswap Router for LP token spending.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
