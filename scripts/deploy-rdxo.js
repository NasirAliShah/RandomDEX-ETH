const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RandomDEX with account:", deployer.address);

  // Constructor parameters
  const defaultAdmin = deployer.address;
  const feeCollector = "0x6E236057972C9B0fcD2DaBe64f484812FA8bBD8E"; // You can change this to a different address
  const feeMaximumNumerator = 3; // 5% maximum fee
  const feeDenominator = 100;
  const fees = {
    buy: 2,  // 2% buy fee
    sell: 2   // 2% sell fee
  };
  const antiBotFees = {
    buy: 25,  // 25% antibot buy fee
    sell: 25  // 25% antibot sell fee
  };
  const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now

  // Explicitly specify the contract from RandomDEX.sol
  const RandomDEX = await ethers.getContractFactory("contracts/RandomDEXOrignal.sol:RandomDEXO");
  const randomDEX = await RandomDEX.deploy(
    defaultAdmin,
    feeCollector,
    feeMaximumNumerator,
    feeDenominator,
    fees,
    antiBotFees,
    antibotEndTimestamp
  );

  await randomDEX.waitForDeployment();
  const randomDEXAddress = await randomDEX.getAddress();
  console.log("RandomDEXV3 deployed to:", randomDEXAddress);

  // Wait for a few block confirmations to ensure the deployment is confirmed
  console.log("Waiting for block confirmations...");
  await randomDEX.deploymentTransaction().wait(6);

  // Verify the contract
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
        antibotEndTimestamp
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