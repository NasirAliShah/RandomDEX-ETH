const { request, gql } = require('graphql-request');

// The Graph API endpoint for the decentralized network
const endpoint = 'https://gateway.thegraph.com/api/subgraphs/id/4jGhpKjW4prWoyt5Bwk1ZHUwdEmNWveJcjEyjoTZWCY9';

// Define the GraphQL query using gql template literal
const query = gql`
  {
    uniswapFactories(first: 1) {
      id
      pairCount
      totalVolumeUSD
      totalVolumeETH
    }
    pair(id: "0x7dc3662f4c2c41c5752652e8b417a9024c2b1f63") {
      id
      token0 {
        id
        symbol
        name
      }
      token1 {
        id
        symbol
        name
      }
      token0Price
      token1Price
      volumeUSD
      reserve0
      reserve1
    }
  }
`;

// Set up the authorization header with your API key
const headers = {
  Authorization: 'Bearer 264aba874bd322682e672dc1cc0c9bde',
};

async function fetchData() {
  try {
    console.log('Fetching data from The Graph API...');
    const data = await request(endpoint, query, null, headers);
    console.log('Data fetched successfully:');
    console.log(JSON.stringify(data, null, 2));
    
    // Extract and display specific information
    if (data.pair) {
      console.log('\nPair Information:');
      console.log(`Pair Address: ${data.pair.id}`);
      console.log(`Token0: ${data.pair.token0.name} (${data.pair.token0.symbol})`);
      console.log(`Token1: ${data.pair.token1.name} (${data.pair.token1.symbol})`);
      console.log(`Price (Token0 per Token1): ${data.pair.token0Price}`);
      console.log(`Price (Token1 per Token0): ${data.pair.token1Price}`);
      console.log(`Reserve0: ${data.pair.reserve0}`);
      console.log(`Reserve1: ${data.pair.reserve1}`);
    } else {
      console.log('\nPair not found. The pair ID might not exist on this subgraph.');
      console.log('Try using a different pair ID or verify that the pair exists on Base.');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    
    // Provide more helpful error information
    if (error.response && error.response.status === 404) {
      console.error('\nThe subgraph endpoint could not be found (404 error).');
      console.error('Please verify the subgraph URL is correct and accessible.');
    } else if (error.message && error.message.includes('removed')) {
      console.error('\nThis subgraph endpoint has been removed or is no longer available.');
      console.error('You may need to find an alternative subgraph for Base Uniswap V2 data.');
      console.error('Try using a hosted service endpoint like:');
      console.error('https://api.thegraph.com/subgraphs/name/messari/uniswap-v2-base');
    }
  }
}

fetchData();
