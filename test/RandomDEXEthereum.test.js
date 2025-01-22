const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("RandomDEX", function () {
  async function deployRandomDEXFixture() {
    const [owner, feeCollector, user1, user2] = await ethers.getSigners();

    const RandomDEX = await ethers.getContractFactory("RandomDEX");

    // Constructor parameters
    const feeMaximumNumerator = 3; // 3% maximum fee
    const feeDenominator = 100;
    const fees = {
      buy: 2,  // 2% buy fee
      sell: 2  // 2% sell fee
    };
    const antiBotFees = {
      buy: 1,  // 1% antibot buy fee
      sell: 1  // 1% antibot sell fee
    };
    const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    const maxSupply = ethers.parseEther("1000000000"); // 1 billion tokens

    const randomDEX = await RandomDEX.deploy(
      owner.address,         // defaultAdmin
      feeCollector.address,  // feeCollector
      feeMaximumNumerator,
      feeDenominator,
      fees,
      antiBotFees,
      antibotEndTimestamp,
      maxSupply
    );

    await randomDEX.waitForDeployment();

    // Grant MINTER_ROLE and BURNER_ROLE to owner for testing
    const MINTER_ROLE = await randomDEX.MINT_ROLE();
    const BURNER_ROLE = await randomDEX.BURN_ROLE();
    await randomDEX.grantRole(MINTER_ROLE, owner.address);
    await randomDEX.grantRole(BURNER_ROLE, owner.address);

    return { randomDEX, owner, feeCollector, user1, user2, MINTER_ROLE, BURNER_ROLE };
  }

  describe("Deployment", function () {
    it("Should set the right admin and fee collector", async function () {
      const { randomDEX, owner, feeCollector } = await loadFixture(deployRandomDEXFixture);

      expect(await randomDEX.hasRole(await randomDEX.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await randomDEX.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should initialize max supply correctly", async function () {
      const { randomDEX } = await loadFixture(deployRandomDEXFixture);

      expect(await randomDEX.maxSupply()).to.equal(ethers.parseEther("1000000000"));
    });
  });

  describe("Whitelisting", function () {
    it("Should allow admin to whitelist an address", async function () {
      const { randomDEX, owner, user1 } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.addToWhitelist(user1.address);
      expect(await randomDEX.isWhitelisted(user1.address)).to.be.true;
    });

    it("Should allow admin to remove an address from whitelist", async function () {
      const { randomDEX, owner, user1 } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.addToWhitelist(user1.address);
      expect(await randomDEX.isWhitelisted(user1.address)).to.be.true;

      await randomDEX.removeFromWhitelist(user1.address);
      expect(await randomDEX.isWhitelisted(user1.address)).to.be.false;
    });
  });

  describe("Fee Mechanism", function () {
    it("Should not charge fee for whitelisted addresses", async function () {
      const { randomDEX, owner, user1, user2 } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.mint(user1.address, ethers.parseEther("1000"));
      await randomDEX.addToWhitelist(user1.address);

      await randomDEX.connect(user1).transfer(user2.address, ethers.parseEther("100"));

      expect(await randomDEX.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should not charge fee for holders with ≥ 25,000 RDX", async function () {
      const { randomDEX, owner, user1, user2 } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.mint(user1.address, ethers.parseEther("25000"));

      await randomDEX.connect(user1).transfer(user2.address, ethers.parseEther("100"));

      expect(await randomDEX.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should charge a 2% fee for regular transfers", async function () {
      const { randomDEX, owner, user1, user2, feeCollector } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.mint(user1.address, ethers.parseEther("1000"));

      await randomDEX.connect(user1).transfer(user2.address, ethers.parseEther("100"));

      expect(await randomDEX.balanceOf(user2.address)).to.equal(ethers.parseEther("98")); // 2% fee deducted
      expect(await randomDEX.balanceOf(feeCollector.address)).to.equal(ethers.parseEther("2"));
    });
  });

  describe("Minting and Burning", function () {
    it("Should allow minting by authorized address", async function () {
      const { randomDEX, owner, user1 } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.mint(user1.address, ethers.parseEther("1000"));
      expect(await randomDEX.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should not allow minting by unauthorized address", async function () {
      const { randomDEX, user1 } = await loadFixture(deployRandomDEXFixture);

      await expect(randomDEX.connect(user1).mint(user1.address, ethers.parseEther("1000"))).to.be.revertedWith(
        "AccessControl: account"
      );
    });

    it("Should allow burning by authorized address", async function () {
      const { randomDEX, owner, user1 } = await loadFixture(deployRandomDEXFixture);

      await randomDEX.mint(user1.address, ethers.parseEther("1000"));
      await randomDEX.burn(user1.address, ethers.parseEther("500"));

      expect(await randomDEX.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should not allow burning by unauthorized address", async function () {
      const { randomDEX, user1 } = await loadFixture(deployRandomDEXFixture);

      await expect(randomDEX.connect(user1).burn(user1.address, ethers.parseEther("500"))).to.be.revertedWith(
        "AccessControl: account"
      );
    });
  });
});
