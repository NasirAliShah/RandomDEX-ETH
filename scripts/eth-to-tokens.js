const hre = require("hardhat");

// Configuration
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL; // Base Sepolia public RPC
const CONTRACT_ADDRESS = "0x4cc72018586e5639605e3340a540e0202057e13A";
const TX_HASH = "0xd52e0719f9588222f77dd10331e80a1773611f415f3609598e99cc986149dc23";

// ABIs
const ABI = [
  "event TokensSelected(address indexed recipient, bool safeMode, bool randomPercentageAllocation, address[] selectedTokens, uint256[] percentages, uint256 totalPercentagesSum)",
  "event TokensSwapped(address indexed recipient, uint256 totalEthTransferred, uint256 totalEthSwapped, uint256 slippageTolerance)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// ERC20 ABI for getting token symbols
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

// Provider and Contract
const provider = new hre.ethers.JsonRpcProvider(RPC_URL);
const contract = new hre.ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

async function getSwapDetails(txHash) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error("Transaction not found");

    // Parse logs
    const logs = receipt.logs.map(log => {
      try {
        return {
          ...contract.interface.parseLog(log),
          address: log.address // Store the contract address that emitted the event
        };
      } catch {
        return null;
      }
    }).filter(log => log !== null);

    // Extract events
    let tokensSelectedEvent, tokensSwappedEvent, transferEvents = [];
    for (const log of logs) {
      if (log.name === "TokensSelected") tokensSelectedEvent = log;
      if (log.name === "TokensSwapped") tokensSwappedEvent = log;
      if (log.name === "Transfer") transferEvents.push(log);
    }

    // Check if required events were found
    if (!tokensSelectedEvent) throw new Error("TokensSelected event not found");
    if (!tokensSwappedEvent) throw new Error("TokensSwapped event not found");

    const { selectedTokens, percentages, totalPercentagesSum } = tokensSelectedEvent.args;
    const totalEthSwapped = hre.ethers.formatEther(tokensSwappedEvent.args.totalEthSwapped);
    const recipient = tokensSelectedEvent.args.recipient;

    // Filter Transfer events for tokens received by the recipient
    const tokenTransfers = transferEvents.filter(event => 
      event.args.to && recipient && // Check for undefined
      event.args.to.toLowerCase() === recipient.toLowerCase() &&
      selectedTokens.some(token => 
        token && event.address && // Check for undefined
        token.toLowerCase() === event.address.toLowerCase()
      )
    );

    // Get token symbols and decimals
    async function getTokenInfo(tokenAddress) {
      try {
        const tokenContract = new hre.ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const symbol = await tokenContract.symbol();
        let decimals = 18; // Default to 18 decimals
        
        try {
          decimals = await tokenContract.decimals();
        } catch (error) {
          console.warn(`Could not get decimals for ${tokenAddress}, using default 18`);
        }
        
        return { symbol, decimals };
      } catch (error) {
        console.warn(`Could not get token info for ${tokenAddress}: ${error.message}`);
        return { symbol: "UNKNOWN", decimals: 18 };
      }
    }
    
    // Get token info for all tokens
    const tokenInfoPromises = selectedTokens.map(token => getTokenInfo(token));
    const tokenInfos = await Promise.all(tokenInfoPromises);
    
    // Calculate ETH allocation and token amounts
    const swapDetails = selectedTokens.map((token, i) => {
      // Handle different types of percentage values (BigNumber, number, string)
      const percentage = typeof percentages[i].toNumber === 'function' ? 
        percentages[i].toNumber() : 
        Number(percentages[i]);
      
      // Handle different types of totalPercentagesSum
      const totalPercentSum = typeof totalPercentagesSum.toNumber === 'function' ? 
        totalPercentagesSum.toNumber() : 
        Number(totalPercentagesSum);
      
      const ethAllocated = (percentage / totalPercentSum) * parseFloat(totalEthSwapped);
      
      // Safely find matching transfer event
      const transferEvent = token ? tokenTransfers.find(event => 
        event.address && token && 
        event.address.toLowerCase() === token.toLowerCase()
      ) : null;
      
      // Get token info
      const { symbol, decimals } = tokenInfos[i];
      
      // Safely get token amount with null checks using the correct decimals
      const tokenAmount = transferEvent && transferEvent.args && transferEvent.args.value ? 
        hre.ethers.formatUnits(transferEvent.args.value, decimals) : "0";

      return {
        tokenAddress: token,
        tokenSymbol: symbol,
        ethAllocated: ethAllocated.toFixed(12), // Readable precision
        tokenAmount: tokenAmount,
        percentage: (percentage / 100).toFixed(2) + "%"
      };
    });

    // Handle different types for BigNumber operations
    let platformFee;
    try {
      // Try using BigNumber subtraction if available
      if (typeof tokensSwappedEvent.args.totalEthTransferred.sub === 'function') {
        platformFee = hre.ethers.formatEther(
          tokensSwappedEvent.args.totalEthTransferred.sub(tokensSwappedEvent.args.totalEthSwapped)
        );
      } else {
        // Fallback to regular number subtraction
        const total = hre.ethers.formatEther(tokensSwappedEvent.args.totalEthTransferred);
        platformFee = (parseFloat(total) - parseFloat(totalEthSwapped)).toFixed(18);
      }
    } catch (error) {
      console.warn("Error calculating platform fee:", error.message);
      platformFee = "0";
    }
    
    return {
      totalEthSent: hre.ethers.formatEther(tokensSwappedEvent.args.totalEthTransferred),
      totalEthSwapped: totalEthSwapped,
      platformFee: platformFee,
      swaps: swapDetails
    };
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

// Run
async function main() {
  const details = await getSwapDetails(TX_HASH);
  if (details) {
    console.log("Transaction Details:", JSON.stringify(details, null, 2));
  }
}

main().catch(console.error);