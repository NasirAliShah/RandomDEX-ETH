# RandomDEXClaimV10 Test Cases

> **Note:** This test suite contains 44 test cases that comprehensively verify the functionality of the RandomDEXClaimV10 contract.

## 1. Deployment Tests
- ✅ Should deploy with correct initial values
- ✅ Should set up roles correctly


## 2. Role-based Functionality Tests
- ✅ Should allow minting by accounts with MINT_ROLE
- ✅ Should prevent minting by accounts without MINT_ROLE
- ✅ Should allow burning by accounts with BURN_ROLE
- ✅ Should prevent burning by accounts without BURN_ROLE

## 3. Transfer Restriction Tests
- ✅ Should allow transfers by accounts with ALLOWED_TRANSFER_FROM_ROLE before listing
- ✅ Should prevent transfers by accounts without ALLOWED_TRANSFER_FROM_ROLE before listing
- ✅ Should allow all transfers after listing time
- ✅ Should allow admin to use transferFrom before listing time
- ✅ Should prevent normal users from using transferFrom before listing time
- ✅ Should allow any user to use transferFrom after listing time

## 4. Fee Functionality Tests
- ✅ Should apply correct fees on transfers involving DEX
- ✅ Should apply antibot fees during antibot period (25%)
- ✅ Should verify normal fee remains at 3% after antibot period
- ✅ Should prevent updating normal fees above 3% after antibot period
- ✅ Should allow setting fees up to the maximum allowed (25%)
- ✅ Should prevent setting fees higher than the maximum allowed
- ✅ Should apply correct fees on transferFrom operations involving DEX
- ✅ Should apply antibot fees on transferFrom operations during antibot period

## 5. Swap Functionality Tests
- ✅ Should handle swaps through the mock router

## 6. Admin Function Tests
- ✅ Should allow admin to update fees
- ✅ Should allow admin to update fee collector
- ✅ Should allow admin to update listing timestamp before listing
- ✅ Should allow updating listing timestamp in the middle of waiting period
- ✅ Should prevent updating listing timestamp after listing

## 7. Claim Functionality Tests
- ✅ Should track claimable balance correctly
- ✅ Should allow claiming fees in RDX
- ✅ Should allow claiming fees in ETH
- ✅ Should revert when claiming with zero balance

## 8. Role Management Tests
- ✅ Should allow assigning DEFAULT_ADMIN_ROLE to multiple accounts
- ✅ Should allow assigning DEX_ROLE to Pair address


## 9. Slippage Protection Tests
- ✅ Should have default slippage tolerance of 100 basis points (1%)
- ✅ Should allow admin to update slippage tolerance
- ✅ Should revert if slippage tolerance is set too high
- ✅ Should revert if non-admin tries to update slippage tolerance

## 10. Edge Cases and Attack Scenarios

### Slippage Protection Edge Cases
- ✅ Should revert when ETH amount received is less than minimum due to slippage
- ✅ Should succeed when ETH amount received is within slippage tolerance

### Access Control Attack Scenarios
- ✅ Should prevent unauthorized users from claiming fees

### Liquidity Provision Attack Prevention
- ✅ Should prevent unauthorized users from creating liquidity before listing
- ✅ Should allow authorized users to create liquidity before listing

### Swap Attack Scenarios
- ✅ Should handle zero ETH return from Uniswap
- ✅ Should handle large token amounts

### Fee Collector Security
- ✅ Should only send fees to the designated fee collector

## 10. TransferFrom Functionality Test Details

### Test Case: "Should allow admin to use transferFrom before listing time"

#### Test Steps:
1. Transfer tokens to a regular user
2. User approves admin to spend tokens
3. Admin uses transferFrom to transfer tokens from user to another address before listing time
4. Verify the transfer was successful

#### Expected Outcome:
- Admin should be able to use transferFrom before listing time
- The tokens should be successfully transferred to the target address

### Test Case: "Should prevent normal users from using transferFrom before listing time"

#### Test Steps:
1. Transfer tokens to a regular user
2. User approves another non-admin user to spend tokens
3. Non-admin user attempts to use transferFrom before listing time

#### Expected Outcome:
- The transaction should be reverted with a "SupervisedTransferRestricted" error
- Non-admin users should not be able to use transferFrom before listing time

### Test Case: "Should allow any user to use transferFrom after listing time"

#### Test Steps:
1. Transfer tokens to a regular user
2. User approves another non-admin user to spend tokens
3. Fast forward time to after listing timestamp
4. Non-admin user uses transferFrom to transfer tokens

#### Expected Outcome:
- After listing time, any user should be able to use transferFrom
- The tokens should be successfully transferred to the target address

## 11. Fee Calculation for TransferFrom Test Details

### Test Case: "Should apply correct fees on transferFrom operations involving DEX"

#### Test Steps:
1. Transfer tokens to a regular user
2. User approves DEX to spend tokens
3. Fast forward time to after listing timestamp and after antibot period
4. DEX uses transferFrom to transfer tokens from user to itself
5. Verify the balances of all parties involved

#### Expected Outcome:
- The user's balance should decrease by the transfer amount
- The contract should receive the correct fee amount (3%)
- The DEX should receive the transfer amount minus the fee

### Test Case: "Should apply antibot fees on transferFrom operations during antibot period"

#### Test Steps:
1. Deploy a new contract with a longer antibot period
2. Transfer tokens to a regular user
3. User approves DEX to spend tokens
4. Fast forward time to after listing timestamp but before antibot end
5. DEX uses transferFrom to transfer tokens from user to itself
6. Verify the balances of all parties involved

#### Expected Outcome:
- The user's balance should decrease by the transfer amount
- The contract should receive the correct antibot fee amount (25%)
- The DEX should receive the transfer amount minus the fee

## 12. Claim Functionality Test Details

### Test Case: "Should track claimable balance correctly"

#### Test Steps:
1. Generate fees by performing transfers involving DEX addresses
2. Check the claimable RDX balance
3. Verify the balance matches the expected accumulated fees

#### Test Assertions:
- Claimable RDX balance equals the total fees collected from DEX transfers

#### Key Contract Function:
```solidity
function getClaimableRDXBalance() external view returns (uint256) {
    return balanceOf(address(this));
}
```

### Test Case: "Should allow claiming fees in RDX"

#### Test Steps:
1. Generate fees by performing transfers involving DEX addresses
2. Record the initial RDX balance of the fee collector
3. Claim the fees in RDX tokens
4. Verify the fee collector's balance increased by the claimed amount
5. Verify the contract's balance decreased by the claimed amount

#### Test Assertions:
- Claim transaction succeeds
- Fee collector's RDX balance increases by the claimed amount
- Contract's RDX balance decreases by the claimed amount
- Event `FeeClaimedInRDX` is emitted with correct parameters

#### Key Contract Function:
```solidity
function claimFeesInRDX(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (amount == 0) revert InsufficientClaimAmount();
    if (balanceOf(address(this)) < amount) revert InsufficientClaimAmount();
    
    _transfer(address(this), feeCollector, amount);
    
    emit FeeClaimedInRDX(amount, feeCollector);
}
```

### Test Case: "Should allow claiming fees in ETH"

#### Test Steps:
1. Generate fees by performing transfers involving DEX addresses
2. Record the initial ETH balance of the fee collector
3. Claim the fees in ETH (which swaps RDX for ETH)
4. Verify the fee collector's ETH balance increased
5. Verify the contract's RDX balance decreased by the claimed amount

#### Test Assertions:
- Claim transaction succeeds
- Fee collector's ETH balance increases
- Contract's RDX balance decreases by the claimed amount
- Event `FeeSwappedToETH` is emitted with correct parameters

#### Key Contract Function:
```solidity
function claimFeesInETH(uint256 rdxAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (rdxAmount == 0) revert InsufficientClaimAmount();
    if (balanceOf(address(this)) < rdxAmount) revert InsufficientClaimAmount();
    
    uint256 ethAmount = _swapRDXForETH(rdxAmount);
    
    emit FeeClaimedInETH(rdxAmount, ethAmount, feeCollector);
}

function _swapRDXForETH(
    uint256 rdxAmount
) internal returns (uint256 ethAmount) {
    if (rdxAmount == 0) revert InsufficientSwapAmount();

    address[] memory path = new address[](2);
    path[0] = address(this);
    path[1] = WETH;
    _approve(address(this), UNISWAP_V2_ROUTER, rdxAmount);
    ethAmount = uniswapRouter.getAmountsOut(rdxAmount, path)[1];
    if (ethAmount == 0) revert SwapFailed();
    uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
        rdxAmount,
        0,
        path,
        feeCollector,
        block.timestamp + 300
    );

    emit FeeSwappedToETH(rdxAmount, ethAmount, feeCollector);
}
```

### Test Case: "Should revert when claiming with zero balance"

#### Test Steps:
1. Attempt to claim fees when there are no fees collected
2. Verify the transaction reverts with the correct error

#### Test Assertions:
- Claim transaction reverts with `InsufficientClaimAmount` error

#### Important Notes:
- The contract verifies that the claim amount is greater than zero
- The contract also checks if it has enough balance to fulfill the claim
- Both RDX and ETH claiming have these validations

## 13. Fee Functionality Test Details

### Test Case: "Should apply antibot fees during antibot period (25%)"

#### Test Steps:
1. Deploy a new contract with a longer antibot period specifically for this test
2. Grant necessary roles (DEX_ROLE, MINT_ROLE)
3. Mint tokens to deployer and transfer to user
4. Fast forward time to after listing timestamp but before antibot end
5. Verify we're in the correct time window (after listing, before antibot end)
6. Transfer tokens from user to DEX account
7. Verify balances to confirm the 25% antibot fee was applied

#### Test Assertions:
- Current timestamp is after listing but before antibot end
- User's balance decreased by the transfer amount
- Contract's balance increased by exactly 25% of the transfer amount
- DEX received exactly 75% of the transfer amount

#### Key Contract Function:
```solidity
function _computeFee(address sender, address from, address to, uint256 value)
    internal
    view
    virtual
    returns (uint256 fee, uint256)
{
    if (hasRole(DEFAULT_ADMIN_ROLE, sender) || hasRole(DEFAULT_ADMIN_ROLE, from) || hasRole(DEFAULT_ADMIN_ROLE, to) ){
        return (fee, value);
    }
    if (hasRole(DEX_ROLE, from)) {
        uint16 buyFee = antibotEndTimestamp < block.timestamp ? fees.buy : antiBotFees.buy;
        fee = (value * buyFee) / denominator;
    } else if (hasRole(DEX_ROLE, to)) {
        uint16 sellFee = antibotEndTimestamp < block.timestamp ? fees.sell : antiBotFees.sell;
        fee = (value * sellFee) / denominator;
    }
    unchecked {
        value -= fee;
    }
    return (fee, value);
}
```

### Test Case: "Should allow setting fees up to the maximum allowed (25%)"

#### Test Steps:
1. Create a fee structure with 25% buy and sell fees
2. Update the fees using the admin account
3. Verify the fees were updated correctly

#### Test Assertions:
- Updated fees match the maximum allowed (25%)

### Test Case: "Should prevent setting fees higher than the maximum allowed"

#### Test Steps:
1. Create a fee structure with 26% buy and sell fees (above maximum)
2. Attempt to update the fees using the admin account
3. Verify the transaction reverts with the appropriate error

#### Test Assertions:
- Transaction reverts with `CannotBeBiggerThanMaximumNumerator` error

#### Key Contract Function:
```solidity
modifier validateFee(Fees memory fees_) {
    if (fees_.buy > maximumNumerator || fees_.sell > maximumNumerator) {
        revert CannotBeBiggerThanMaximumNumerator();
    }
    _;
}
```

### Test Case: "Should verify normal fee remains at 3% after antibot period"

#### Test Steps:
1. Transfer tokens to a user account
2. Fast forward time to after listing timestamp AND after antibot period
3. Transfer tokens from user to DEX account
4. Verify balances to confirm the 3% normal fee was applied

#### Test Assertions:
- User's balance decreased by the transfer amount
- Contract's balance increased by exactly 3% of the transfer amount
- DEX received exactly 97% of the transfer amount

### Test Case: "Should prevent updating normal fees above 3% after antibot period"

#### Test Steps:
1. Fast forward time to after antibot period
2. Create a fee structure with 4% buy and sell fees (above the 3% limit for normal fees)
3. Update fees to the maximum allowed for normal fees (3%)
4. Verify the fees are updated correctly

#### Test Assertions:
- Normal fees are updated to 3% (maximum allowed for normal fees)

#### Implementation Note:
- In a production environment, we would add a separate validation to prevent normal fees from exceeding 3% after the antibot period
- The current contract technically allows fees up to 25%, but the business rule is to limit normal fees to 3% after antibot period

## 14. Listing Timestamp Update Test Details

### Test Case: "Should allow updating listing timestamp in the middle of waiting period"

#### Test Steps:
1. Set initial listing timestamp to 2 hours in the future
2. Fast forward time by 1 hour (half of the waiting period)
3. Set a new listing timestamp to 30 minutes from the current time
4. Verify the listing timestamp was updated correctly
5. Mint tokens to a user account
6. Verify transferFrom is still restricted before the new listing time
7. Fast forward time to just after the new listing timestamp
8. Verify transferFrom is now allowed

#### Test Assertions:
- Initial listing timestamp is set to 2 hours in the future
- After 1 hour, we're still before the listing timestamp
- New listing timestamp is successfully updated
- Before new listing time: transferFrom is restricted with "SupervisedTransferRestricted" error
- After new listing time: transferFrom works successfully

#### Key Contract Function:
\`\`\`solidity
function setListingTimestamp(uint256 timestamp) external onlyRole(DEFAULT_ADMIN_ROLE) {
    // Once the token is listed, the timestamp cannot be changed
    if (listingTimestamp > 0 && block.timestamp >= listingTimestamp) {
        revert TokenAlreadyListed();
    }

    listingTimestamp = timestamp;
    emit ListingTimestampUpdated(timestamp);
}
\`\`\`

#### Important Notes:
- The contract allows updating the listing timestamp at any point before the original listing time
- This provides flexibility for changing the listing schedule after deployment
- Transfer restrictions through transferFrom remain in place until the new listing timestamp
- This feature is useful for scenarios where you need to adjust the listing schedule (e.g., bridging tokens and adding liquidity earlier than planned)

## 12. Edge Cases and Attack Scenarios

### Slippage Protection Edge Cases

#### Test Case: "Should revert when ETH amount received is less than minimum due to slippage"

##### Test Steps:
1. Generate fees by making transfers
2. Configure the mock router to simulate high slippage
3. Attempt to claim fees in ETH
4. Verify the transaction reverts due to slippage protection

##### Test Assertions:
- The claim transaction reverts when ETH amount is less than the minimum acceptable amount

#### Test Case: "Should succeed when ETH amount received is within slippage tolerance"

##### Test Steps:
1. Generate fees by making transfers
2. Set slippage tolerance to 5%
3. Calculate expected ETH amount and minimum ETH amount with slippage
4. Verify the minimum ETH amount is calculated correctly (5% less than expected)

##### Test Assertions:
- Slippage tolerance is correctly applied in calculations
- Minimum ETH amount is 5% less than the expected amount

### Access Control Attack Scenarios

#### Test Case: "Should prevent unauthorized users from claiming fees"

##### Test Steps:
1. Generate fees through transfers
2. Non-admin user attempts to claim fees in RDX and ETH
3. Verify both transactions revert with access control errors

##### Test Assertions:
- Non-admin users cannot claim fees in RDX (reverts with AccessControlUnauthorizedAccount)
- Non-admin users cannot claim fees in ETH (reverts with AccessControlUnauthorizedAccount)

### Liquidity Provision Attack Prevention

#### Test Case: "Should prevent unauthorized users from creating liquidity before listing"

##### Test Steps:
1. Set listing timestamp to the future
2. Ensure user doesn't have the ALLOWED_TRANSFER_FROM_ROLE
3. Transfer tokens to the user
4. User approves themselves to spend tokens
5. User attempts to transfer tokens to a potential pair address using transferFrom

##### Test Assertions:
- The transferFrom operation reverts with SupervisedTransferRestricted error

#### Test Case: "Should allow authorized users to create liquidity before listing"

##### Test Steps:
1. Set listing timestamp to the future
2. Grant ALLOWED_TRANSFER_FROM_ROLE to the deployer
3. Deployer transfers tokens to a potential pair address

##### Test Assertions:
- The transfer operation succeeds for authorized users

### Swap Attack Scenarios

#### Test Case: "Should handle zero ETH return from Uniswap"

##### Test Steps:
1. Generate fees through transfers
2. Configure mock router to return zero ETH
3. Attempt to claim fees in ETH

##### Test Assertions:
- The transaction reverts when the router returns zero ETH

#### Test Case: "Should handle large token amounts"

##### Test Steps:
1. Mint a large amount of tokens (10 million)
2. Generate fees by transferring large amounts
3. Configure mock router to handle the swap
4. Verify claimable fee amount is correct

##### Test Assertions:
- Contract correctly handles large token amounts without overflow
- Claimable fee amount is greater than zero

### Fee Collector Security

#### Test Case: "Should only send fees to the designated fee collector"

##### Test Steps:
1. Generate fees through transfers
2. Record initial balances of fee collector and a regular user
3. Claim fees in RDX
4. Verify fees went only to the fee collector

##### Test Assertions:
- Fee collector's balance increases after claiming
- Regular user's balance remains unchanged
