// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../libraries/ERC20Fee.sol";

/**
 * @title RandomDEXV1
 * @notice RandomDEXV1 is a token with automatic ETH fee conversion.
 */
contract RandomDEXV1 is ERC20, ERC20Permit, AccessControl, ERC20Fee {
    // Define role identifiers
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");

    // Uniswap Router for Sepolia Testnet
    IUniswapV2Router02 public uniswapRouter;
    address public immutable WETH;
    address public immutable UNISWAP_V2_ROUTER;

    // Maximum supply of tokens
    uint256 public maxSupply;

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event FeeCharged(address indexed from, address indexed to, uint256 fee);
    event FeeSwappedToETH(uint256 rdxAmount, uint256 ethAmount);
    event TransferCompleted(address indexed from, address indexed to, uint256 amount);

    /**
     * @dev Constructor to initialize the token with all parameters.
     */
    constructor(
        address defaultAdmin_,
        address feeCollector_,
        uint16 feeMaximumNumerator_,
        uint16 feeDenominator_,
        Fees memory fees_,
        Fees memory antiBotFees_,
        uint256 antibotEndTimestamp_,
        uint256 maxSupply_,
        address uniswapRouter_ // Address of Uniswap V2 Router (Sepolia Testnet)
    )
        ERC20("RandomDEXV1", "RDXV1")
        ERC20Permit("RandomDEXV1")
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

        // Initialize state variables
        maxSupply = maxSupply_;

        // Uniswap Router Address for Sepolia Testnet
        UNISWAP_V2_ROUTER = uniswapRouter_;
        uniswapRouter = IUniswapV2Router02(UNISWAP_V2_ROUTER);
        WETH = uniswapRouter.WETH();

        // Grant roles to the default admin
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin_);
        _grantRole(MINT_ROLE, defaultAdmin_);
    }

    /**
     * @notice Mint new tokens to a specified address.
     */
    function mint(address to, uint256 amount) external onlyRole(MINT_ROLE) {
        require(to != address(0), "Invalid receiver address");
        require(amount > 0, "Invalid token amount");
        require(totalSupply() + amount <= maxSupply, "Maximum supply exceeded");

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burn tokens from a specified address.
     */
    function burn(address from, uint256 amount) external onlyRole(BURN_ROLE) {
        require(from != address(0), "Invalid sender address");
        require(amount > 0, "Invalid token amount");

        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /**
     * @notice Override `_update` to handle RDX fee deduction, swap to ETH, and transfer to feeCollector.
     */
    function _update(address from, address to, uint256 amount) internal virtual override(ERC20) {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            emit TransferCompleted(from, to, amount);
            return;
        }

        // Calculate Fee using ERC20Fee contract
        (uint256 fee, uint256 rest) = super._computeFee(_msgSender(), from, to, amount);

        if (fee > 0) {
            // Transfer fee to contract
            super._transfer(from, address(this), fee);
            emit FeeCharged(from, to, fee);

            // Swap fee RDX for ETH
            uint256 ethAmount = _swapRDXForETH(fee);

            // Send ETH to Fee Collector
            (bool success, ) = feeCollector.call{value: ethAmount}("");
            require(success, "ETH transfer failed");
        }

        // Transfer the remaining RDX
        super._update(from, to, rest);
        emit TransferCompleted(from, to, rest);
    }

    /**
     * @notice Swaps `rdxAmount` to ETH using Uniswap.
     * @dev Uses `swapExactTokensForETHSupportingFeeOnTransferTokens`
     */
    function _swapRDXForETH(uint256 rdxAmount) internal returns (uint256 ethAmount) {
        require(rdxAmount > 0, "No RDX to swap");

        // Approve Uniswap to spend RDX
        _approve(address(this), UNISWAP_V2_ROUTER, rdxAmount);

        // Convert the RDX fee amount to ETH
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WETH;

        uint256 initialETHBalance = address(this).balance;

        // Execute the swap
        uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            rdxAmount,  // Amount of RDX to swap
            0,          // Accept any amount of ETH
            path,
            address(this), // Receive ETH in contract
            block.timestamp + 300
        );

        // Calculate received ETH
        ethAmount = address(this).balance - initialETHBalance;
        emit FeeSwappedToETH(rdxAmount, ethAmount);
    }

    /**
     * @notice Allow contract to receive ETH.
     */
    receive() external payable {}
}
