const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contract with account:", deployer.address);


    // Define constructor arguments
    const defaultAdmin = process.env.DEFAULT_ADMIN;
    const feeCollector = process.env.FEE_COLLECTOR;
    const feeMaximumNumerator = 5; // Example: 5% fee
    const feeDenominator = 100; // Fee denominator
    const fees = {
         buyFee: 5,
         sellFee: 5 
        }; // Example: 5% buy/sell fee
    const antiBotFees = {
         buyFee: 25,
          sellFee: 25 
        }; // Example: 25% anti-bot fee
    const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    const maxSupply = hre.ethers.parseEther("1000000000"); // 1 Billion Tokens
    const RandomDEX = await ethers.getContractFactory("RandomDEX");

    // Deploy contract
    const contract = await RandomDEX.deploy(
        defaultAdmin,
        feeCollector,
        feeMaximumNumerator,
        feeDenominator,
        fees,
        antiBotFees,
        antibotEndTimestamp,
        maxSupply
    );

    await contract.waitForDeployment();

    console.log("RandomDEX deployed to:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});