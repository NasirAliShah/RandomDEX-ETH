# RandomDEX Token Contract 🪙

## Overview
RandomDEX is a customizable ERC20-based token with advanced functionality, including:

- Cross-chain mint/burn capabilities
- Fee exemptions for specific users based on roles, balances, or whitelisting
- Dynamic fee structure (including antibot fees)
- Support for role-based access control via OpenZeppelin's AccessControl

This contract is highly flexible and designed for scenarios where advanced fee management and exemptions are required.

## Features

### Fee Mechanism
- **Fee Exemptions**:
  - Accounts with DEFAULT_ADMIN_ROLE
  - Whitelisted addresses
  - Users with balances above the feeWaiverThreshold
- **Dynamic Fee Calculation**:
  - Buy Fee: Applied when the from address has DEX_ROLE
  - Sell Fee: Applied when the to address has DEX_ROLE
  - Antibot Fee: Temporarily higher fees for antibot protection, active until antibotEndTimestamp

### Mint/Burn Functionality
- Mint tokens: Only callable by accounts with the MINT_ROLE
- Burn tokens: Only callable by accounts with the BURN_ROLE

### Whitelist Management
- Add/remove accounts from the whitelist via the WHITELIST_MANAGER_ROLE

### Dynamic Fee Waiver Threshold
- Admin can update the feeWaiverThreshold for flexible fee exemption management

### Events for Transparency
- Emissions for all critical actions such as transfers, fee deductions, minting, burning, and whitelist updates

## Contract Deployment

### Prerequisites
- Node.js (version >= 16)
- Hardhat
- Ethers.js
- A wallet with access to the deployment network

### Deployment Steps
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd RandomDEX
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the contracts:
   ```bash
   npx hardhat compile
   ```

4. Deploy the contract:
   ```bash
   npx hardhat run scripts/deploy.js --network <network>
   ```

## Key Contract Functions

### Minting & Burning
- **Mint Tokens**: `mint(address to, uint256 amount)`
  - Only callable by MINT_ROLE
  - Mints new tokens to the specified address

- **Burn Tokens**: `burn(address from, uint256 amount)`
  - Only callable by BURN_ROLE
  - Burns tokens from the specified address

### Fee Management
Fees are automatically calculated during transfers and sent to the feeCollector.
Key parameters include:
- Standard fees (buy/sell)
- Antibot fees (buy/sell)
- Antibot duration timestamp

### Whitelist Management
- **Add to Whitelist**: `addToWhitelist(address account)`
- **Remove from Whitelist**: `removeFromWhitelist(address account)`
- **Check Status**: `isWhitelisted(address account) -> bool`

## Testing

### Running Tests
```bash
npx hardhat test
```

### Test Coverage
The test suite covers:
- Fee exemptions for admins, whitelisted addresses, and high-balance users
- Correct fee deduction for buy/sell operations
- Dynamic fee waiver threshold functionality
- Minting and burning token operations
- Whitelist management

## Security Considerations

### Access Control
- Ensure only authorized accounts have sensitive roles (DEFAULT_ADMIN_ROLE, MINT_ROLE, etc.)
- Verify role assignments before deployment

### Fee Parameters
- Carefully configure fees and antiBotFees to prevent undesirable behavior

### Whitelist Management
- Maintain strict control over whitelist additions and removals
- Regularly audit whitelist members