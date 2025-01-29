const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomDEX Fee Mechanism - Extended Tests", function () {
  let RandomDEX, randomDEX;
  let deployer, feeCollector, user, dexAccount, whitelistedUser;
  let MINT_ROLE, DEX_ROLE, WHITELIST_MANAGER_ROLE;

  beforeEach(async function () {
    [deployer, feeCollector, user, dexAccount, whitelistedUser] = await ethers.getSigners();

    // Deploy the RandomDEX contract
    RandomDEX = await ethers.getContractFactory("RandomDEX");
    randomDEX = await RandomDEX.deploy(
      deployer.address,
      feeCollector.address,
      5, // feeMaximumNumerator = 5%
      100, // feeDenominator = 100
      { buy: 2, sell: 2 }, // fees
      { buy: 25, sell: 25 }, // antiBotFees
      Math.floor(Date.now() / 1000) + 86400, // antibotEndTimestamp (24 hours)
      ethers.parseEther("1000000000"), // maxSupply = 1,000,000,000
      ethers.parseEther("35000") // feeWaiverThreshold = 35,000 RDX
    );
    await randomDEX.waitForDeployment();

    // Get roles
    MINT_ROLE = await randomDEX.MINT_ROLE();
    DEX_ROLE = await randomDEX.DEX_ROLE();
    WHITELIST_MANAGER_ROLE = await randomDEX.WHITELIST_MANAGER_ROLE();

    // Grant roles
    await randomDEX.grantRole(MINT_ROLE, deployer.address);
    await randomDEX.grantRole(DEX_ROLE, dexAccount.address);
    await randomDEX.grantRole(WHITELIST_MANAGER_ROLE, deployer.address);

    // Mint initial tokens
    await randomDEX.mint(user.address, ethers.parseEther("1000"));
    await randomDEX.mint(deployer.address, ethers.parseEther("50000"));
    await randomDEX.mint(dexAccount.address, ethers.parseEther("100000"));
    await randomDEX.mint(whitelistedUser.address, ethers.parseEther("100000"));
  });

  // Original test cases (maintained as-is)
  it("Should charge antibot sell fees when transferring to DEX_ROLE account", async function () {
    const transferAmount = ethers.parseEther("200");
    const expectedFee = (BigInt(transferAmount) * 25n) / 100n;
    const expectedTransfer = BigInt(transferAmount) - expectedFee;

    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));

    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(expectedFee);

    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(expectedTransfer);

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should not charge fees when transferring to a non-DEX_ROLE account", async function () {
    const transferAmount = ethers.parseEther("100");

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const recipientBalanceBefore = BigInt(await randomDEX.balanceOf(deployer.address));

    await randomDEX.connect(user).transfer(deployer.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    const recipientBalanceAfter = BigInt(await randomDEX.balanceOf(deployer.address));
    expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(BigInt(transferAmount));

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should not charge fees for transfers by accounts with DEFAULT_ADMIN_ROLE", async function () {
    const transferAmount = ethers.parseEther("300");

    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const adminBalanceBefore = BigInt(await randomDEX.balanceOf(deployer.address));

    await randomDEX.connect(deployer).transfer(user.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceAfter - userBalanceBefore).to.equal(BigInt(transferAmount));

    const adminBalanceAfter = BigInt(await randomDEX.balanceOf(deployer.address));
    expect(adminBalanceBefore - adminBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should not charge fees for transfers by whitelisted addresses", async function () {
    await randomDEX.connect(deployer).addToWhitelist(user.address);

    const transferAmount = ethers.parseEther("100");

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));

    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(BigInt(transferAmount));

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });
  it("Should charge fees for transfers by non-whitelisted addresses", async function () {
    const transferAmount = ethers.parseEther("100"); // Transfer amount
    const expectedFee = (BigInt(transferAmount) * 25n) / 100n; // 25% fee
    const expectedTransfer = BigInt(transferAmount) - expectedFee; // Amount after fees
  
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));
  
    // Transfer from user to DEX_ROLE account
    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);
  
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
  
    // Verify fee collector received the correct fee
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(expectedFee);
  
    // Verify DEX_ROLE account received the correct amount after fee deduction
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(expectedTransfer);
  
    // Verify user balance decreased by the full transfer amount
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount)); // Total deduction
  });

  it("Should not charge fees for users with balances >= feeWaiverThreshold", async function () {
    const transferAmount = ethers.parseEther("100");

    const feeWaiverThreshold = ethers.parseEther("35000");
    expect(await randomDEX.balanceOf(whitelistedUser.address)).to.be.gte(feeWaiverThreshold);

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(whitelistedUser.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));

    await randomDEX.connect(whitelistedUser).transfer(dexAccount.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(BigInt(transferAmount));

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(whitelistedUser.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should charge fees for transfers by non-whitelisted addresses with balances < feeWaiverThreshold", async function () {
    const transferAmount = ethers.parseEther("200");
    const expectedFee = (BigInt(transferAmount) * 25n) / 100n;
    const expectedTransfer = BigInt(transferAmount) - expectedFee;

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore).to.be.below(ethers.parseEther("35000"));

    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));

    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(expectedFee);

    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(expectedTransfer);

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should deactivate antibot fees after antibot period ends", async function () {
    await network.provider.send("evm_increaseTime", [86401]); // Increase time by 24 hours + 1 second
    await network.provider.send("evm_mine"); // Mine a new block

    const transferAmount = ethers.parseEther("200");
    const expectedFee = (BigInt(transferAmount) * 2n) / 100n; // Standard fee after antibot period
    const expectedTransfer = BigInt(transferAmount) - expectedFee;

    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));

    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(expectedFee);

    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(expectedTransfer);

    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });
});
