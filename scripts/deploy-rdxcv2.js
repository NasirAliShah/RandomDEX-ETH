const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RandomDEXClaimV2 with account:", deployer.address);

  // Constructor parameters
  const defaultAdmin = deployer.address;
  const feeCollector = "0xE5a3Ab3d673a5CaB01F0fbd89Ac830BF37665271"; // Third account from metamask Fee collector address
  const feeMaximumNumerator = 50; // 5% maximum fee
  const feeDenominator = 1000; // Denominator for fee calculation
  const fees = {
    buy: 50,  // 5% buy fee
    sell: 50  // 5% sell fee
  };
  const antiBotFees = {
    buy: 250,  // 25% antibot buy fee
    sell: 250  // 25% antibot sell fee
  };
  const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now
  const maxSupply = hre.ethers.parseEther("1000000000"); // 1,000,000,000 tokens
  const uniswapRouter = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Uniswap V2 Router for Sepolia Testnet


  // Explicitly specify the contract from RandomDEXV6.sol
  const RandomDEX = await ethers.getContractFactory("contracts/RandomDEXClaimV2.sol:RandomDEXClaimV2");
  const randomDEX = await RandomDEX.deploy(
    defaultAdmin,
    feeCollector,
    feeMaximumNumerator,
    feeDenominator,
    fees,
    antiBotFees,
    antibotEndTimestamp,
    maxSupply,
    uniswapRouter
    );

  await randomDEX.waitForDeployment();
  const randomDEXAddress = await randomDEX.getAddress();
  console.log("RandomDEXClaimV2 deployed to:", randomDEXAddress);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await randomDEX.deploymentTransaction().wait(6);

  // Verify the contract on Sepolia (using Etherscan)
  console.log("Verifying contract..."); 
  try {
    await hre.run("verify:verify", {
      address: randomDEXAddress,
      constructorArguments: [
        defaultAdmin,
        feeCollector,
        feeMaximumNumerator,
        feeDenominator,
        fees,
        antiBotFees,
        antibotEndTimestamp,
        maxSupply,
        uniswapRouter
      ],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Error verifying contract:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });