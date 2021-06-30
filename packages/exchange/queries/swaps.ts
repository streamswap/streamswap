import { ApolloClient, gql, InMemoryCache } from '@apollo/client';

export interface User {
  id: string
  continuousSwaps: ContinuousSwap[]
}

export interface Token {
  id: string
  symbol: string
  name: string
  decimals: number
}

export interface ContinuousSwap {
  tokenIn: Token
  tokenOut: Token
  rateIn: string
  minOut: string
  maxOut: string
}

export const CLIENT = new ApolloClient({ uri: 'https://api.thegraph.com/subgraphs/name/streamswap/streamswap', cache: new InMemoryCache()});

export const SWAPS_FROM_ADDRESS_FROM_TOKEN = gql`
query GetSwapsFromAddressFromToken($address: String!, $tokenIn: String!) {
  continuousSwaps(where: {user: $address, tokenIn: $tokenIn}) {
    user {
      id
    }
    tokenIn {
      id
      symbol
      name
    }
    tokenOut {
      id
      symbol
      name
    }

    rateIn
  }
}`;
export const USER_INFO = gql`
query GetUserInfo($address: String!) {
  user(id: $address) {
    id
    continuousSwaps {
      tokenIn {
        symbol
        name
        decimals
        tokenDayData {
          date
          dailyVolumeToken
          dailyTxns
        }
      }
      tokenOut {
        symbol
        name
        decimals
        tokenDayData {
          date
          dailyVolumeToken
          dailyTxns
        }
      }

      rateIn
    }
  }
  }`;

export const ALL_TOKENS = gql`
query GetAllTokens {
  tokens {
    name
    symbol
    decimals
  }
}`;