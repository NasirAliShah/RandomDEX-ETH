// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

/**
 * @title MockUniswapV2Pair
 * @notice A mock implementation of Uniswap V2 Pair for testing purposes
 */
contract MockUniswapV2Pair {
    address public token0;
    address public token1;
    uint public reserve0;
    uint public reserve1;
    uint32 public blockTimestampLast;
    
    /**
     * @notice Set the token addresses for the pair
     * @param _token0 The address of token0
     * @param _token1 The address of token1
     */
    function setTokens(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }
    
    /**
     * @notice Set the reserves for the pair
     * @param _reserve0 The reserve for token0
     * @param _reserve1 The reserve for token1
     */
    function setReserves(uint _reserve0, uint _reserve1) external {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = uint32(block.timestamp);
    }
    
    /**
     * @notice Get the reserves for the pair
     * @return The reserves for token0, token1, and the last block timestamp
     */
    function getReserves() external view returns (uint112, uint112, uint32) {
        return (uint112(reserve0), uint112(reserve1), blockTimestampLast);
    }
    
    /**
     * @notice Mock implementation of swap
     */
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external {
        // This is a mock function that doesn't actually do anything
        // In a real implementation, this would transfer tokens
    }
}
