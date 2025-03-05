const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomDEX Contract", function () {
  let RandomDEX, randomDEX;
  let deployer, feeCollector, user, dexAccount, minter, burner;
  let MINT_ROLE, BURN_ROLE;

  beforeEach(async function () {
    [deployer, feeCollector, user, dexAccount, minter, burner] = await ethers.getSigners();

    // Constructor parameters
    const defaultAdmin = deployer.address;
    const feeCollectorAddress = deployer.address;
    
    // Make sure these values fit within uint16 range (0-65535)
    const feeMaximumNumerator = 300; 
    const feeDenominator = 10000;
    
    // Create proper struct objects for fees
    const fees = { buy: 300, sell: 300 };
    const antiBotFees = { buy: 2500, sell: 2500 };
    
    const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 1200;
    const uniswapRouter = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";
    const listingTimestamp = Math.floor(Date.now() / 1000) + 3600;

    // Use the RandomDEX contract instead of RandomDEXClaimV10
    RandomDEX = await ethers.getContractFactory("RandomDEX");
    
    try {
      // Pass Fees as Arrays (as RandomDEX expects them)
      const standardFees = [3, 3]; // BuyFee = 3%, SellFee = 3%
      const antiBotFees = [25, 25]; // AntiBot Buy/Sell Fees = 25%

      randomDEX = await RandomDEX.deploy(
        defaultAdmin,
        feeCollectorAddress,
        feeMaximumNumerator,
        feeDenominator,
        standardFees,
        antiBotFees,
        antibotEndTimestamp,
        ethers.parseEther("1000000000") // maxSupply = 1B Tokens
      );

      await randomDEX.waitForDeployment();
      
      // Get Role Identifiers
      MINT_ROLE = await randomDEX.MINT_ROLE();
      BURN_ROLE = await randomDEX.BURN_ROLE();
    } catch (error) {
      console.error("Deployment failed with error:", error);
      throw error;
    }
  });
  
  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await randomDEX.name()).to.equal("RandomDEX");
      expect(await randomDEX.symbol()).to.equal("RDX");
      expect(await randomDEX.maxSupply()).to.equal(ethers.parseEther("1000000000"));
    });

    it("Should assign DEFAULT_ADMIN_ROLE to deployer", async function () {
      expect(await randomDEX.hasRole(await randomDEX.DEFAULT_ADMIN_ROLE(), deployer.address)).to.be.true;
    });

    it("Should not grant MINT_ROLE and BURN_ROLE by default", async function () {
      expect(await randomDEX.hasRole(MINT_ROLE, deployer.address)).to.be.false;
      expect(await randomDEX.hasRole(BURN_ROLE, deployer.address)).to.be.false;
    });
  });
});