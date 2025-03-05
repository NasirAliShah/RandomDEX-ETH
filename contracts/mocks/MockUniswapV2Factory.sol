// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "./MockUniswapV2Pair.sol";

/**
 * @title MockUniswapV2Factory
 * @notice A mock implementation of Uniswap V2 Factory for testing purposes
 */
contract MockUniswapV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    address public feeTo;
    address public feeToSetter;
    
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);
    
    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }
    
    /**
     * @notice Get the number of pairs created
     * @return The number of pairs
     */
    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }
    
    /**
     * @notice Mock implementation of createPair
     * @param tokenA The address of tokenA
     * @param tokenB The address of tokenB
     * @return pair The address of the created pair
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS');
        
        // Deploy a new mock pair
        MockUniswapV2Pair mockPair = new MockUniswapV2Pair();
        mockPair.setTokens(token0, token1);
        
        // Store the pair
        pair = address(mockPair);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
    
    /**
     * @notice Set the fee recipient
     * @param _feeTo The address to receive fees
     */
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeTo = _feeTo;
    }
    
    /**
     * @notice Set the fee setter
     * @param _feeToSetter The address that can set fees
     */
    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }
    
    /**
     * @notice Set an existing pair
     * @param tokenA The address of tokenA
     * @param tokenB The address of tokenB
     * @param pair The address of the pair
     */
    function setExistingPair(address tokenA, address tokenB, address pair) external {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        
        // Only add to allPairs if it's not already there
        bool exists = false;
        for (uint i = 0; i < allPairs.length; i++) {
            if (allPairs[i] == pair) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            allPairs.push(pair);
            emit PairCreated(token0, token1, pair, allPairs.length);
        }
    }
}
