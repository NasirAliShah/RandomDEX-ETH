const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RandomDEX Fee Mechanism", function () {
  let RandomDEX, randomDEX;
  let deployer, feeCollector, user, dexAccount, whitelistedUser;
  let MINT_ROLE, DEX_ROLE, WHITELIST_MANAGER_ROLE;

  beforeEach(async function () {
    // Setup accounts
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

    // Mint 1000 tokens to user
    await randomDEX.mint(user.address, ethers.parseEther("1000"));
    await randomDEX.mint(deployer.address, ethers.parseEther("50000")); // Mint 50,000 RDX to deployer
    await randomDEX.mint(dexAccount.address, ethers.parseEther("100000")); // Mint 100,000 RDX to dexAccount
    await randomDEX.mint(whitelistedUser.address, ethers.parseEther("100000")); // Mint 100,000 RDX to whitelistedUser

  });

  it("Should charge antibot sell fees when transferring to DEX_ROLE account", async function () {
    const transferAmount = ethers.parseEther("200"); // Amount to transfer (200 RDX)
    const expectedFee = (BigInt(transferAmount) * 25n) / 100n; // 25% fee (custom calculation)
    const expectedTransfer = BigInt(transferAmount) - expectedFee; // Remaining after deducting fee

    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));

    // Transfer from user to DEX_ROLE account
    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

    // Verify fee collector received the fee
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(expectedFee);

    // Verify DEX_ROLE account received the correct amount after fee deduction
    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(expectedTransfer);

    // Verify user balance decreased correctly
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should not charge fees when transferring to a non-DEX_ROLE account", async function () {
    const transferAmount = ethers.parseEther("100"); // Amount to transfer (100 RDX)

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const recipientBalanceBefore = BigInt(await randomDEX.balanceOf(deployer.address));

    // Transfer from user to a non-DEX_ROLE account
    await randomDEX.connect(user).transfer(deployer.address, transferAmount);

    // Verify no fees were charged
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    // Verify recipient received the full transfer amount
    const recipientBalanceAfter = BigInt(await randomDEX.balanceOf(deployer.address));
    expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(BigInt(transferAmount));

    // Verify user balance decreased by the full transfer amount
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should not charge fees for transfers by accounts with DEFAULT_ADMIN_ROLE", async function () {
    const transferAmount = ethers.parseEther("300"); // Amount to transfer (300 RDX)

    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const adminBalanceBefore = BigInt(await randomDEX.balanceOf(deployer.address));

    // Transfer from admin to user
    await randomDEX.connect(deployer).transfer(user.address, transferAmount);

    // Verify no fees were charged
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    // Verify recipient received the full transfer amount
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceAfter - userBalanceBefore).to.equal(BigInt(transferAmount));

    // Verify admin balance decreased by the full transfer amount
    const adminBalanceAfter = BigInt(await randomDEX.balanceOf(deployer.address));
    expect(adminBalanceBefore - adminBalanceAfter).to.equal(BigInt(transferAmount));
  });
  it("Should not charge fees for transfers by whitelisted addresses", async function () {
    // Add user to the whitelist
    await randomDEX.connect(deployer).addToWhitelist(user.address);

    const transferAmount = ethers.parseEther("100"); // Transfer amount: 100 RDX

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(user.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));

    // Transfer from whitelisted user to dexAccount
    await randomDEX.connect(user).transfer(dexAccount.address, transferAmount);

    // Verify no fees were charged
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    // Verify dexAccount received the full transfer amount
    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(BigInt(transferAmount));

    // Verify user balance decreased by the full transfer amount
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should not charge fees for users with balances >= feeWaiverThreshold", async function () {
    const transferAmount = ethers.parseEther("100"); // Transfer amount: 100 RDX
    // Ensure user1 has a balance >= feeWaiverThreshold
    const feeWaiverThreshold = ethers.parseEther("35000"); // 35,000 RDX
    expect(await randomDEX.balanceOf(whitelistedUser.address)).to.be.gte(feeWaiverThreshold);

    const userBalanceBefore = BigInt(await randomDEX.balanceOf(whitelistedUser.address));
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));

    // Transfer from user (who has > 35,000 RDX) to dexAccount
    await randomDEX.connect(whitelistedUser).transfer(dexAccount.address, transferAmount);

    // Verify no fees were charged
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter - feeCollectorBalanceBefore).to.equal(0n);

    // Verify dexAccount received the full transfer amount
    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter - dexBalanceBefore).to.equal(BigInt(transferAmount));

    // Verify user balance decreased by the full transfer amount
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(user.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(BigInt(transferAmount));
  });

  it("Should charge fees for transfers by non-whitelisted addresses with balances < feeWaiverThreshold", async function () {
    const transferAmount = ethers.parseEther("200"); // Amount to transfer (200 RDX)
    const expectedFee = (BigInt(transferAmount) * 25n) / 100n; // 25% fee (custom calculation)
    const expectedTransfer = BigInt(transferAmount) - expectedFee; // Remaining after deducting fee

  
    // Ensure user's balance is below feeWaiverThreshold
    const userBalanceBefore = BigInt(await randomDEX.balanceOf(whitelistedUser.address));
    expect(userBalanceBefore).to.be.below(ethers.parseEther("35000")); // Assert balance < threshold
  
    const feeCollectorBalanceBefore = BigInt(await randomDEX.balanceOf(feeCollector.address));
    const dexBalanceBefore = BigInt(await randomDEX.balanceOf(dexAccount.address));
  
    // Transfer from non-whitelisted user (with balance < feeWaiverThreshold) to dexAccount
    await randomDEX.connect(whitelistedUser).transfer(dexAccount.address, transferAmount);
  
    // Verify fee collector received the fee
    const feeCollectorBalanceAfter = BigInt(await randomDEX.balanceOf(feeCollector.address));
    expect(feeCollectorBalanceAfter- feeCollectorBalanceBefore).to.equal(expectedFee);
  
    // Verify dexAccount received the correct amount after fees
    const dexBalanceAfter = BigInt(await randomDEX.balanceOf(dexAccount.address));
    expect(dexBalanceAfter- dexBalanceBefore).to.equal(expectedTransfer);
  
    // Verify user's balance decreased by the full transfer amount
    const userBalanceAfter = BigInt(await randomDEX.balanceOf(whitelistedUser.address));
    expect(userBalanceBefore - userBalanceAfter).to.equal(transferAmount);
  });
  

});
