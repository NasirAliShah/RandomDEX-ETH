const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RandomDEX with account:", deployer.address);

  // Constructor parameters
  const defaultAdmin = deployer.address;
  const feeCollector = deployer.address; // You can change this to a different address
  const feeMaximumNumerator = 5; // 5% maximum fee
  const feeDenominator = 100;
  const fees = {
    buy: 2,  // 2% buy fee
    sell: 2   // 2% sell fee
  };
  const antiBotFees = {
    buy: 25,  // 25% antibot buy fee
    sell: 25  // 25% antibot sell fee
  };
  const initialFeeWaiverThreshold = hre.ethers.parseEther("35000"); // 35,000 tokens for fee waiver
  const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
  const maxSupply = hre.ethers.parseEther("1000000000"); // Equivalent to 1,000,000,000 tokens
  // Explicitly specify the contract from RandomDEX.sol
  const RandomDEX = await ethers.getContractFactory("contracts/RandomDEX.sol:RandomDEX");
  const randomDEX = await RandomDEX.deploy(
    defaultAdmin,
    feeCollector,
    feeMaximumNumerator,
    feeDenominator,
    fees,
    antiBotFees,
    antibotEndTimestamp,
    maxSupply,
    initialFeeWaiverThreshold
  );

  await randomDEX.waitForDeployment();
  console.log("EthRandomDEX deployed to:", await randomDEX.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });