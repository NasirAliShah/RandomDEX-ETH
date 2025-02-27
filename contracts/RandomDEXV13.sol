// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "../libraries/ERC20Fee.sol";

/**
 * @title RandomDEXV13
 * @notice RandomDEXV13 is a token with cross-chain mint/burn functionality, fee exemptions for specific users, and advanced fee management logic.
 */
contract RandomDEXV13 is ERC20, ERC20Permit, AccessControl, ERC20Fee {
    // Define role identifiers for minting, burning, and whitelist management
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    // The maximum supply of tokens that can be minted
    uint256 public maxSupply;

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event FeeCharged(address indexed from, address indexed to, uint256 fee);
    event TokensBridged(address indexed from, address indexed to, uint256 amount);

    /**
     * @dev Constructor to initialize the RandomDEXV13 token with all required parameters.
     * @param defaultAdmin_ The address with the `DEFAULT_ADMIN_ROLE` role.
     * @param feeCollector_ The address that collects transaction fees.
     * @param feeMaximumNumerator_ The maximum numerator for fee percentages.
     * @param feeDenominator_ The denominator for fee calculations.
     * @param fees_ The standard buy/sell fees configuration.
     * @param antiBotFees_ The antibot buy/sell fees configuration.
     * @param antibotEndTimestamp_ The timestamp when antibot fees end.
     * @param maxSupply_ The maximum supply of tokens that can be minted.
     */
    constructor(
        address defaultAdmin_,
        address feeCollector_,
        uint16 feeMaximumNumerator_,
        uint16 feeDenominator_,
        Fees memory fees_,
        Fees memory antiBotFees_,
        uint256 antibotEndTimestamp_,
        uint256 maxSupply_
    )
        ERC20("RandomDEXV13", "RDXV13")
        ERC20Permit("RandomDEXV13")
        ERC20Fee(
            defaultAdmin_,
            feeCollector_,
            feeMaximumNumerator_,
            feeDenominator_,
            fees_,
            antiBotFees_,
            antibotEndTimestamp_
        )
    {
        require(defaultAdmin_ != address(0), "RandomDEXV13: invalid admin address");
        require(feeCollector_ != address(0), "RandomDEXV13: invalid fee collector address");
        require(maxSupply_ > 0, "RandomDEXV13: max supply must be greater than zero");

        // Initialize state variables
        maxSupply = maxSupply_;

        // Grant role to the default admin address
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin_);
        // Will be removed for mainnet deployment
        _grantRole(MINT_ROLE, defaultAdmin_);

    }

    /**
     * @notice Mint new tokens to a specified address.
     * @dev Only callable by accounts with the `MINT_ROLE`.
     * Emits a `TokensMinted` event.
     * @param to The address receiving the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(MINT_ROLE) {
        require(to != address(0), "RandomDEXV13: invalid receiver address");
        require(amount > 0, "RandomDEXV13: invalid token amount");
        require(totalSupply() + amount <= maxSupply, "RandomDEXV13: maximum supply exceeded");

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burn tokens from a specified address.
     * @dev Only callable by accounts with the `BURN_ROLE`.
     * Emits a `TokensBurned` event.
     * @param from The address from which tokens will be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) external onlyRole(BURN_ROLE) {
        require(from != address(0), "RandomDEXV13: invalid sender address");
        require(amount > 0, "RandomDEXV13: invalid token amount");

        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /**
     * @notice Override `_update` to handle fee collection and exemptions during token transfers.
     * Emits `FeeCharged` and `TransferCompleted` events.
     * @param from The sender's address.
     * @param to The recipient's address.
     * @param amount The amount of tokens to transfer.
     */
    function _update(address from, address to, uint256 amount) internal virtual override(ERC20) {
        // Skip fee calculation for minting and burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            emit TokensBridged(from, to, amount);
            return;
        }


        // Calculate fees using the base ERC20Fee logic
        (uint256 fee, uint256 rest) = super._computeFee(_msgSender(), from, to, amount);

        // If there's a fee, transfer it to the fee collector
        if (fee > 0) {
            super._transfer(from, feeCollector, fee);
            emit FeeCharged(from, to, fee);
        }

        // Transfer the remaining amount
        super._update(from, to, rest);
    }
}