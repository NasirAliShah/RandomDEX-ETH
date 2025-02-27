// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../libraries/ERC20Fee.sol";

/**
 * @title RandomDEXClaim
 * @notice Charges 5% fee on DEX swaps (ETH <-> RDX), stores RDX fees in contract, swaps to ETH on admin claim.
 */
contract RandomDEXClaim is ERC20Fee, ERC20Permit {
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
        ERC20("RandomDEXClaim", "RDXC")
        ERC20Permit("RandomDEXClaim")
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
    }

    function mint(address to, uint256 amount) external onlyRole(MINT_ROLE) {
        require(to != address(0), "Invalid receiver address");
        require(amount > 0, "Invalid token amount");
        require(totalSupply() + amount <= maxSupply, "Maximum supply exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURN_ROLE) {
        require(from != address(0), "RandomDEXClaim: invalid sender address");
        require(amount > 0, "RandomDEXClaim: invalid token amount");
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

        if (fee > 0) {
            // Collect fee in RDX and store in contract
            super._transfer(from, address(this), fee);
            emit FeeCharged(from, to, fee);
        }

        super._update(from, to, rest);
        emit TransferCompleted(from, to, rest);
    }

    // Admin function to swap accumulated RDX fees to ETH and send to feeCollector
    function claim() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 rdxBalance = balanceOf(address(this));
        require(rdxBalance > 0, "No RDX to claim");

        uint256 ethAmount = _swapRDXForETH(rdxBalance);
        (bool success, ) = feeCollector.call{value: ethAmount}("");
        require(success, "ETH transfer to fee collector failed");
    }

    function _swapRDXForETH(uint256 rdxAmount) internal returns (uint256 ethAmount) {
        require(rdxAmount > 0, "No RDX to swap");

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WETH;

        uint256 initialETHBalance = address(this).balance;

        uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            rdxAmount,
            0,
            path,
            address(this),
            block.timestamp + 300
        );

        ethAmount = address(this).balance - initialETHBalance;
        emit FeeSwappedToETH(rdxAmount, ethAmount);
    }

    receive() external payable {}
}