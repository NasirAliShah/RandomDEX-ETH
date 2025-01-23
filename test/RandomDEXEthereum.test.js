const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomDEX", function () {
  let RandomDEX, randomDEX;
  let owner, feeCollector, user1, user2, user3;

  const feeMaximumNumerator = 3; // 3% max fee
  const feeDenominator = 100; // Denominator for percentages
  const fees = { buy: 2, sell: 2 }; // 2% buy/sell fees
  const antiBotFees = { buy: 5, sell: 5 }; // 5% antibot buy/sell fees
  const antibotEndTimestamp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
  const maxSupply = ethers.parseEther("1000000000"); // 1,000,000,000 tokens
  const initialFeeWaiverThreshold = ethers.parseEther("35000"); // 35,000 tokens

  beforeEach(async function () {
    [owner, feeCollector, user1, user2, user3] = await ethers.getSigners();

    RandomDEX = await ethers.getContractFactory("RandomDEX");
    randomDEX = await RandomDEX.deploy(
      owner.address,
      feeCollector.address,
      feeMaximumNumerator,
      feeDenominator,
      fees,
      antiBotFees,
      antibotEndTimestamp,
      maxSupply,
      initialFeeWaiverThreshold
    );
    await randomDEX.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct admin and fee collector", async function () {
      expect(await randomDEX.hasRole(await randomDEX.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await randomDEX.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should initialize the fee waiver threshold correctly", async function () {
      expect(await randomDEX.feeWaiverThreshold()).to.equal(initialFeeWaiverThreshold);
    });

    it("Should initialize the max supply correctly", async function () {
      expect(await randomDEX.maxSupply()).to.equal(maxSupply);
    });
  });

  describe("Fee Waiver Threshold", function () {
    it("Admin should be able to update the fee waiver threshold", async function () {
      const newThreshold = ethers.parseEther("50000"); // 50,000 tokens
      await randomDEX.updateFeeWaiverThreshold(newThreshold);
      expect(await randomDEX.feeWaiverThreshold()).to.equal(newThreshold);
    });

    it("Non-admin should not be able to update the fee waiver threshold", async function () {
      const newThreshold = ethers.parseEther("50000"); // 50,000 tokens
      await expect(randomDEX.connect(user1).updateFeeWaiverThreshold(newThreshold)).to.be.revertedWith(
        "AccessControl"
      );
    });

    it("Should exempt users with balance >= fee waiver threshold from fees", async function () {
      const transferAmount = ethers.parseEther("100");
      const waiverThreshold = await randomDEX.feeWaiverThreshold();
    
      // Fund user1 with a balance exceeding the fee waiver threshold
      await randomDEX.connect(owner).transfer(user1.address, waiverThreshold.add(transferAmount));
    
      // Check if user1 meets the fee waiver threshold
      expect(await randomDEX.balanceOf(user1.address)).to.be.gte(waiverThreshold);
    
      // Perform a transfer and verify no fees are charged
      const feeCollectorBalanceBefore = await randomDEX.balanceOf(feeCollector.address);
      await randomDEX.connect(user1).transfer(user2.address, transferAmount);
    
      // Verify fee collector balance remains unchanged
      expect(await randomDEX.balanceOf(feeCollector.address)).to.equal(feeCollectorBalanceBefore);
    
      // Verify recipient received the full transfer amount
      expect(await randomDEX.balanceOf(user2.address)).to.equal(transferAmount);
    });
    
  });

  describe("Whitelist Management", function () {
    it("Admin should be able to add addresses to the whitelist", async function () {
      await randomDEX.addToWhitelist(user1.address);
      expect(await randomDEX.isWhitelisted(user1.address)).to.be.true;
    });

    it("Admin should be able to remove addresses from the whitelist", async function () {
      await randomDEX.addToWhitelist(user1.address);
      expect(await randomDEX.isWhitelisted(user1.address)).to.be.true;

      await randomDEX.removeFromWhitelist(user1.address);
      expect(await randomDEX.isWhitelisted(user1.address)).to.be.false;
    });

    it("Non-admin should not be able to modify the whitelist", async function () {
      await expect(randomDEX.connect(user1).addToWhitelist(user2.address)).to.be.revertedWith("AccessControl");
      await expect(randomDEX.connect(user1).removeFromWhitelist(user2.address)).to.be.revertedWith("AccessControl");
    });

    it("Whitelisted addresses should be exempt from fees", async function () {
      const transferAmount = ethers.parseEther("100");

      // Whitelist user1
      await randomDEX.addToWhitelist(user1.address);

      // Perform a transfer and verify no fees are charged
      const feeCollectorBalanceBefore = await randomDEX.balanceOf(feeCollector.address);
      await randomDEX.connect(user1).transfer(user2.address, transferAmount);

      // Verify fee collector balance remains unchanged
      expect(await randomDEX.balanceOf(feeCollector.address)).to.equal(feeCollectorBalanceBefore);

      // Verify recipient received the full transfer amount
      expect(await randomDEX.balanceOf(user2.address)).to.equal(transferAmount);
    });
  });

  describe("Fee Mechanism", function () {
    it("Should charge fees for regular transfers", async function () {
      const transferAmount = ethers.parseEther("100");
      const expectedFee = transferAmount.mul(fees.buy).div(feeDenominator);
      const expectedTransfer = transferAmount.sub(expectedFee);

      // Mint tokens to user1
      await randomDEX.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

      // Perform a transfer
      const feeCollectorBalanceBefore = await randomDEX.balanceOf(feeCollector.address);
      await randomDEX.connect(user1).transfer(user2.address, transferAmount);

      // Verify fee collector received the fee
      expect(await randomDEX.balanceOf(feeCollector.address)).to.equal(
        feeCollectorBalanceBefore.add(expectedFee)
      );

      // Verify recipient received the remaining amount
      expect(await randomDEX.balanceOf(user2.address)).to.equal(expectedTransfer);
    });
  });
});
