// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../libraries/ERC20Fee.sol";

/**
 * @title RandomDEXV9
 * @notice Charges sell fees on DEX swaps (RDX -> ETH), swaps to ETH, and sends to feeCollector.
 */
contract RandomDEXV9 is ERC20, ERC20Permit, AccessControl, ERC20Fee {
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");

    IUniswapV2Router02 public immutable uniswapRouter;
    address public immutable WETH;
    address public immutable UNISWAP_V2_ROUTER;
    uint256 public maxSupply;

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event FeeCharged(address indexed from, address indexed to, uint256 fee);
    event FeeSwappedToETH(uint256 rdxAmount, uint256 ethAmount);
    event TransferCompleted(address indexed from, address indexed to, uint256 amount);

    constructor(
        address defaultAdmin_,
        address feeCollector_,
        uint16 feeMaximumNumerator_,
        uint16 feeDenominator_,
        Fees memory fees_,
        Fees memory antiBotFees_,
        uint256 antibotEndTimestamp_,
        uint256 maxSupply_,
        address uniswapRouter_
    )
        ERC20("RandomDEXV9", "RDXV9")
        ERC20Permit("RandomDEXV9")
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
        require(uniswapRouter_ != address(0), "Invalid router address");

        maxSupply = maxSupply_;
        UNISWAP_V2_ROUTER = uniswapRouter_;
        uniswapRouter = IUniswapV2Router02(UNISWAP_V2_ROUTER);
        WETH = uniswapRouter.WETH();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin_);
        _grantRole(MINT_ROLE, defaultAdmin_);

        _approve(address(this), UNISWAP_V2_ROUTER, type(uint256).max); // Pre-approve Router for fee swaps
    }

    function mint(address to, uint256 amount) external onlyRole(MINT_ROLE) {
        require(to != address(0), "Invalid receiver address");
        require(amount > 0, "Invalid token amount");
        require(totalSupply() + amount <= maxSupply, "Maximum supply exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURN_ROLE) {
        require(from != address(0), "RandomDEXV9: invalid sender address");
        require(amount > 0, "RandomDEXV9: invalid token amount");
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    function _update(address from, address to, uint256 amount) internal virtual override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            emit TransferCompleted(from, to, amount);
            return;
        }

        (uint256 fee, uint256 rest) = super._computeFee(_msgSender(), from, to, amount);
        require(fee + rest == amount, "Invalid fee calculation");

        if (fee > 0 && from != address(this)) { // Prevent nested swaps
            super._transfer(from, address(this), fee);
            emit FeeCharged(from, to, fee);

            uint256 ethAmount = _swapRDXForETH(fee);
            (bool success, ) = feeCollector.call{value: ethAmount}("");
            require(success, "ETH transfer to fee collector failed");
        }

        super._update(from, to, rest);
        emit TransferCompleted(from, to, rest);
    }

    function _swapRDXForETH(uint256 rdxAmount) internal returns (uint256 ethAmount) {
        require(rdxAmount > 0, "No RDX to swap");

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WETH;

        uint256 initialETHBalance = address(this).balance;

        uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            rdxAmount,
            0, // No minimum ETH requirement
            path,
            address(this),
            block.timestamp + 300
        );

        ethAmount = address(this).balance - initialETHBalance;
        emit FeeSwappedToETH(rdxAmount, ethAmount);
    }

    // Override _computeFee to charge sell fee only
    function _computeFee(address sender, address from, address to, uint256 value)
        internal
        view
        virtual
        override
        returns (uint256 fee, uint256)
    {
        if (hasRole(DEFAULT_ADMIN_ROLE, sender) || hasRole(DEFAULT_ADMIN_ROLE, from) || hasRole(DEFAULT_ADMIN_ROLE, to)) {
            return (0, value);
        }
        // Charge sell fee when transferring to DEX pair
        if (hasRole(DEX_ROLE, to)) {
            uint16 sellFee = antibotEndTimestamp < block.timestamp ? fees.sell : antiBotFees.sell;
            fee = (value * sellFee) / denominator;
            return (fee, value - fee);
        }
        // No fee on buy (pair-to-user) or contract-to-pair
        return (0, value);
    }

    receive() external payable {}
}