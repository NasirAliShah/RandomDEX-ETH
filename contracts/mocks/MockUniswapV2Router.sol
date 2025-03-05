// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// Simple IERC20 interface for the mock router
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/**
 * @title MockUniswapV2Router
 * @notice A mock implementation of Uniswap V2 Router for testing purposes
 */
contract MockUniswapV2Router {
    // Allow the contract to receive ETH
    receive() external payable {}
    fallback() external payable {}
    address public immutable WETH;
    address public mockPair;
    address public mockFactory;
    uint256 public mockEthAmount;
    
    constructor(address weth) {
        WETH = weth;
        mockFactory = address(0x1111111111111111111111111111111111111111);
    }
    
    /**
     * @notice Set the mock pair address
     * @param _mockPair The address of the mock pair
     */
    function setMockPair(address _mockPair) external {
        mockPair = _mockPair;
    }
    
    /**
     * @notice Set the mock factory address
     * @param _mockFactory The address of the mock factory
     */
    function setMockFactory(address _mockFactory) external {
        mockFactory = _mockFactory;
    }
    
    /**
     * @notice Get the factory address
     * @return The factory address
     */
    function factory() external view returns (address) {
        return mockFactory;
    }
    
    /**
     * @notice Mock implementation of addLiquidity
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        return (amountADesired, amountBDesired, amountADesired);
    }
    
    /**
     * @notice Mock implementation of addLiquidityETH
     */
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        return (amountTokenDesired, msg.value, amountTokenDesired);
    }
    
    /**
     * @notice Mock implementation of swapExactTokensForTokens
     */
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        uint[] memory result = new uint[](path.length);
        result[0] = amountIn;
        result[1] = amountIn * 98 / 100; // 2% slippage simulation
        return result;
    }
    
    /**
     * @notice Mock implementation of swapExactETHForTokens
     */
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts) {
        uint[] memory result = new uint[](path.length);
        result[0] = msg.value;
        result[1] = msg.value * 98 / 100; // 2% slippage simulation
        return result;
    }
    
    // Original swapExactTokensForETH removed to avoid duplication
    
    /**
     * @notice Mock implementation of getAmountsOut
     */
    function getAmountsOut(uint amountIn, address[] calldata path) 
        external 
        pure 
        returns (uint[] memory amounts) 
    {
        uint[] memory result = new uint[](path.length);
        result[0] = amountIn;
        result[1] = amountIn * 98 / 100; // 2% slippage simulation
        return result;
    }
    
    /**
     * @notice Mock implementation of swapTokensForExactTokens
     */
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        uint[] memory result = new uint[](path.length);
        result[0] = amountOut * 102 / 100; // 2% more input needed
        result[1] = amountOut;
        return result;
    }
    
    /**
     * @notice Mock implementation of swapETHForExactTokens
     */
    function swapETHForExactTokens(
        uint amountOut,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts) {
        uint[] memory result = new uint[](path.length);
        result[0] = msg.value;
        result[1] = amountOut;
        return result;
    }
    
    /**
     * @notice Mock implementation of swapTokensForExactETH
     */
    function swapTokensForExactETH(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        uint[] memory result = new uint[](path.length);
        result[0] = amountOut * 102 / 100; // 2% more input needed
        result[1] = amountOut;
        return result;
    }
    
    /**
     * @notice Set the mock ETH amount to return for swaps
     * @param _mockEthAmount The amount of ETH to return
     */
    function setMockEthAmount(uint256 _mockEthAmount) external {
        mockEthAmount = _mockEthAmount;
    }
    
    /**
     * @notice Override swapExactTokensForETH to use the mockEthAmount
     */
    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        uint[] memory result = new uint[](path.length);
        result[0] = amountIn;
        result[1] = mockEthAmount > 0 ? mockEthAmount : amountIn * 98 / 100; // Use mock amount if set
        
        // Transfer ETH to the recipient
        (bool success, ) = to.call{value: result[1]}("");
        require(success, "ETH transfer failed");
        
        return result;
    }
    
    /**
     * @notice Implementation of swapExactTokensForETHSupportingFeeOnTransferTokens
     * @dev This is the same as swapExactTokensForETH but for tokens with transfer fees
     */
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external {
        uint[] memory result = new uint[](path.length);
        result[0] = amountIn;
        result[1] = mockEthAmount > 0 ? mockEthAmount : amountIn * 98 / 100; // Use mock amount if set
        
        // Consume the tokens from the sender (the contract)
        // We need to use IERC20 to call transferFrom
        IERC20 token = IERC20(path[0]);
        token.transferFrom(msg.sender, address(this), amountIn);
        
        // Transfer ETH to the recipient
        (bool success, ) = to.call{value: result[1]}("");
        require(success, "ETH transfer failed");
    }
}
