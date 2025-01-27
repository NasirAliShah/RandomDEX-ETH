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
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");

    /// @dev Whitelist mapping for fee exemptions
    mapping(address => bool) private _whitelist;

    /// @dev Maximum supply that can be minted on this chain
    uint256 public maxSupply;

    /// @dev Minimum balance for fee waiver
    uint256 public feeWaiverThreshold;

    /// @dev Event emitted when the fee waiver threshold is updated
    event FeeWaiverThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(
        address defaultAdmin_,
        address feeCollector_,
        uint16 feeMaximumNumerator_,
        uint16 feeDenominator_,
        Fees memory fees_,
        Fees memory antiBotFees_,
        uint256 antibotEndTimestamp_,
        uint256 maxSupply_,
        uint256 initialFeeWaiverThreshold_
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
        feeWaiverThreshold = initialFeeWaiverThreshold_;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin_);
        _grantRole(MINT_ROLE, defaultAdmin_);
        _grantRole(BURN_ROLE, defaultAdmin_);
        _grantRole(WHITELIST_MANAGER_ROLE, defaultAdmin_);
    }

    function mint(address to, uint256 amount) external onlyRole(MINT_ROLE) {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Mint amount must be greater than zero");
        require(totalSupply() + amount <= maxSupply, "Exceeds maximum supply");

        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURN_ROLE) {
        require(from != address(0), "Burn from zero address");
        require(amount > 0, "Burn amount must be greater than zero");

        _burn(from, amount);
    }

    function updateFeeWaiverThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newThreshold > 0, "Threshold must be greater than zero");
        uint256 oldThreshold = feeWaiverThreshold;
        feeWaiverThreshold = newThreshold;

        emit FeeWaiverThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Override _update to handle fee collection and exemptions
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) {
        // Skip fee calculation for minting and burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Check for fee exemptions
        if (
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
            _whitelist[from] ||
            balanceOf(from) >= feeWaiverThreshold
        ) {
            super._update(from, to, amount);
            return;
        }

        // Calculate fees using the base ERC20Fee logic
        (uint256 fee, uint256 rest) = super._computeFee(_msgSender(), from, to, amount);

        // If there's a fee, transfer it to the fee collector
        if (fee > 0) {
            super._transfer(from, feeCollector, fee);
        }

        // Transfer the remaining amount
        super._update(from, to, rest);
    }

    function addToWhitelist(address account) external onlyRole(WHITELIST_MANAGER_ROLE) {
        require(account != address(0), "Invalid address");
        _whitelist[account] = true;
    }

    function removeFromWhitelist(address account) external onlyRole(WHITELIST_MANAGER_ROLE) {
        require(account != address(0), "Invalid address");
        _whitelist[account] = false;
    }

    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }
}
