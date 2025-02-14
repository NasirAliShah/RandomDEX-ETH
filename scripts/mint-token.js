const hre = require("hardhat");

async function main() {
  const [admin] = await hre.ethers.getSigners();
  const contractAddress = "0x759986E654BDA7E95aA1041a85a70933958a51B2";
  const RandomDEX = await ethers.getContractFactory("contracts/RandomDEXEth.sol:RandomDEXV1");
  const randomDEX = RandomDEX.attach(contractAddress);

  console.log("Minting 100,000 RDXV1 to admin...");
  const mintTx = await randomDEX.mint(admin.address, hre.ethers.parseEther("100000"));
  await mintTx.wait();

  const balance = await randomDEX.balanceOf(admin.address);
  console.log(`New Balance: ${hre.ethers.formatEther(balance)} RDXV1`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
