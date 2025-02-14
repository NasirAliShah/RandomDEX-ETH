const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const LP_TOKEN_ADDRESS = "0x147359eA4D35f6D6c722c7c246bB79194443e9dE"; // Your LP token address

  const lpToken = await ethers.getContractAt("IERC20", LP_TOKEN_ADDRESS);
  const balance = await lpToken.balanceOf(deployer.address);

  console.log(`✅ Your LP Token Balance: ${ethers.formatUnits(balance, 18)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
