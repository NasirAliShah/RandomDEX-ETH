const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomDEX Contract", function () {
  let RandomDEX, randomDEX;
  let deployer, feeCollector, user, dexAccount, minter, burner;
  let MINT_ROLE, BURN_ROLE;

  beforeEach(async function () {
    [deployer, feeCollector, user, dexAccount, minter, burner] = await ethers.getSigners();

    RandomDEX = await ethers.getContractFactory("RandomDEX");

    // Pass Fees as Arrays (as Solidity expects them)
    const standardFees = [2, 2]; // BuyFee = 2%, SellFee = 2%
    const antiBotFees = [25, 25]; // AntiBot Buy/Sell Fees = 25%

    // Deploy Contract
    randomDEX = await RandomDEX.deploy(
      deployer.address, 
      feeCollector.address, 
      5, // feeMaximumNumerator
      100, // feeDenominator
      standardFees, 
      antiBotFees, 
      Math.floor(Date.now() / 1000) + 86400, // antibotEndTimestamp (24 hours)
      ethers.parseEther("1000000000") // maxSupply = 1B Tokens
    );
    await randomDEX.waitForDeployment();

    // Get Role Identifiers
    MINT_ROLE = await randomDEX.MINT_ROLE();
    BURN_ROLE = await randomDEX.BURN_ROLE();
  });

  // 📌 1️⃣ Deployment Tests
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

  // 📌 2️⃣ Minting Tests
  describe("Minting", function () {
    it("Should fail minting without MINT_ROLE", async function () {
      await expect(randomDEX.mint(user.address, ethers.parseEther("100")))
      .to.be.revertedWithCustomError(randomDEX, "AccessControlUnauthorizedAccount");
    });

    it("Should allow minting after granting MINT_ROLE", async function () {
      await randomDEX.grantRole(MINT_ROLE, minter.address);
      await randomDEX.connect(minter).mint(user.address, ethers.parseEther("500"));
      expect(await randomDEX.balanceOf(user.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should not allow minting above max supply", async function () {
      await randomDEX.grantRole(MINT_ROLE, minter.address);
      await expect(randomDEX.connect(minter).mint(user.address, ethers.parseEther("1000000001")))
        .to.be.revertedWith("Exceeds maximum supply");
    });
  });

  // 📌 3️⃣ Burning Tests
  describe("Burning", function () {
    beforeEach(async function () {
      await randomDEX.grantRole(MINT_ROLE, minter.address);
      await randomDEX.connect(minter).mint(user.address, ethers.parseEther("500"));
    });

    it("Should fail burning without BURN_ROLE", async function () {
      await expect(randomDEX.mint(user.address, ethers.parseEther("100")))
      .to.be.revertedWithCustomError(randomDEX, "AccessControlUnauthorizedAccount");
    });

    it("Should allow burning after granting BURN_ROLE", async function () {
      await randomDEX.grantRole(BURN_ROLE, burner.address);
      await randomDEX.connect(burner).burn(user.address, ethers.parseEther("200"));
      expect(await randomDEX.balanceOf(user.address)).to.equal(ethers.parseEther("300"));
    });

    it("Should revert burning from zero address", async function () {
      await randomDEX.grantRole(BURN_ROLE, burner.address);
      await expect(randomDEX.connect(burner).burn(ethers.ZeroAddress, ethers.parseEther("100")))
        .to.be.revertedWith("Burn from zero address");
    });
  });

  // 📌 4️⃣ Transfer & Fee Mechanism
  describe("Transfers & Fees", function () {
    beforeEach(async function () {
      await randomDEX.grantRole(MINT_ROLE, minter.address);
      await randomDEX.connect(minter).mint(user.address, ethers.parseEther("1000"));
    });

    it("Should charge fees when transferring to non-exempt accounts", async function () {
      const transferAmount = ethers.parseEther("200");
      const expectedFee = (BigInt(transferAmount) * 2n) / 100n; // 2% fee
      const expectedTransfer = BigInt(transferAmount) - expectedFee;

      const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
      const recipientBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));

      await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

      const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
      expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(expectedFee);

      const recipientBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(expectedTransfer);
    });

    it("Should not charge fees for admin transfers", async function () {
      await randomDEX.grantRole(MINT_ROLE, deployer.address);
      await randomDEX.mint(deployer.address, ethers.parseEther("500"));

      const transferAmount = ethers.parseEther("300");

      await randomDEX.connect(deployer).transfer(user.address, transferAmount);
      expect(await randomDEX.balanceOf(user.address)).to.equal(ethers.parseEther("1300"));
    });
  });

  // 📌 5️⃣ Antibot Fees
  describe("Antibot Fees", function () {
    beforeEach(async function () {
      await randomDEX.grantRole(MINT_ROLE, minter.address);
      await randomDEX.connect(minter).mint(user.address, ethers.parseEther("1000"));
    });

    it("Should charge higher antibot fees before antibotEndTimestamp", async function () {
      const transferAmount = ethers.parseEther("200");
      const expectedFee = (BigInt(transferAmount) * 25n) / 100n; // 25% antibot fee

      await expect(randomDEX.connect(user).transfer(dexAccount.address, transferAmount))
        .to.emit(randomDEX, "FeeCharged")
        .withArgs(user.address, dexAccount.address, expectedFee);
    });

    it("Should switch to normal fees after antibot period ends", async function () {
      await network.provider.send("evm_increaseTime", [86401]);
      await network.provider.send("evm_mine");

      const transferAmount = ethers.parseEther("200");
      const expectedFee = (BigInt(transferAmount) * 2n) / 100n;

      await expect(randomDEX.connect(user).transfer(dexAccount.address, transferAmount))
        .to.emit(randomDEX, "FeeCharged")
        .withArgs(user.address, dexAccount.address, expectedFee);
    });
  });
});
