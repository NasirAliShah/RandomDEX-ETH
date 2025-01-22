// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "../libraries/ERC20Fee.sol";

/**
 * @title RandomDEX
 * @notice RandomDEX token with cross-chain mint/burn functionality and fee exemptions for specific users.
 */
contract RandomDEX is ERC20, ERC20Permit, AccessControl, ERC20Fee {
       /// @dev Role for Axelar Router to call mint and burn
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");

    /// @dev Whitelist mapping for fee exemptions
    mapping(address => bool) private _whitelist;

    /// @dev Maximum supply that can be minted on this chain
    uint256 public maxSupply;

    /// @dev Minimum balance for fee waiver (25,000 tokens)
    uint256 private constant FEE_WAIVER_THRESHOLD = 25_000 * 10 ** 18;

    /**
     * @notice Contract constructor.
     * @param defaultAdmin_ The admin address (typically the deployer or Axelar manager).
     * @param feeCollector_ The address to collect transaction fees.
     * @param feeMaximumNumerator_ The maximum numerator for fee calculations.
     * @param feeDenominator_ The denominator for fee calculations.
     * @param fees_ The standard fee percentages.
     * @param antiBotFees_ The antibot fee percentages.
     * @param antibotEndTimestamp_ The timestamp at which antibot fees end.
     * @param maxSupply_ The maximum supply that can be minted on Ethereum.
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
        ERC20("RandomDEX", "RDX")
        ERC20Permit("RandomDEX")
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
        require(defaultAdmin_ != address(0), "Invalid admin address");
        require(feeCollector_ != address(0), "Invalid fee collector address");
        require(maxSupply_ > 0, "Max supply must be greater than zero");

        maxSupply = maxSupply_;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin_);
        _grantRole(MINT_ROLE, defaultAdmin_);
        _grantRole(BURN_ROLE, defaultAdmin_);
        _grantRole(WHITELIST_MANAGER_ROLE, defaultAdmin_);
    }

    /**
     * @notice Mint tokens to a specified address (authorized by Axelar or admin).
     * @param to The address to mint tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(MINT_ROLE) {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Mint amount must be greater than zero");
        require(totalSupply() + amount <= maxSupply, "Exceeds maximum supply");

        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from a specified address (authorized by Axelar or admin).
     * @param from The address to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) external onlyRole(BURN_ROLE) {
        require(from != address(0), "Burn from zero address");
        require(amount > 0, "Burn amount must be greater than zero");

        _burn(from, amount);
    }

    /**
     * @notice Override `_computeFee` to add fee exemption for specific users.
     * @param sender The address initiating the transaction.
     * @param from The sender of the tokens.
     * @param to The recipient of the tokens.
     * @param value The amount of tokens being transferred.
     * @return fee The calculated fee.
     * @return remaining The amount remaining after the fee is deducted.
     */
    function _computeFee(address sender, address from, address to, uint256 value)
        internal
        view
        virtual
        override
        returns (uint256 fee, uint256 remaining)
    {
        // Admins, whitelisted addresses, or users holding >= 25,000 RDX are exempt from fees
        if (
            hasRole(DEFAULT_ADMIN_ROLE, sender) ||
            _whitelist[from] ||
            balanceOf(from) >= FEE_WAIVER_THRESHOLD
        ) {
            return (0, value);
        }

        // Use the existing fee calculation logic from `ERC20Fee`
        return super._computeFee(sender, from, to, value);
    }

    /**
     * @notice Add an address to the whitelist (fee exemption).
     * @param account The address to whitelist.
     */
    function addToWhitelist(address account) external onlyRole(WHITELIST_MANAGER_ROLE) {
        require(account != address(0), "Invalid address");
        _whitelist[account] = true;
    }

    /**
     * @notice Remove an address from the whitelist (fee exemption).
     * @param account The address to remove from the whitelist.
     */
    function removeFromWhitelist(address account) external onlyRole(WHITELIST_MANAGER_ROLE) {
        require(account != address(0), "Invalid address");
        _whitelist[account] = false;
    }

    /**
     * @notice Check if an address is whitelisted.
     * @param account The address to check.
     * @return True if the address is whitelisted, otherwise false.
     */
    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }
}
