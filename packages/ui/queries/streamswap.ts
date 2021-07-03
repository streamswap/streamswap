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

export interface Pool {
  id: string
}

export interface ContinuousSwap {
  pool: { id: string }
  tokenIn: Token
  tokenOut: Token
  rateIn: string
  currentRateOut: string
  minOut: string
  maxOut: string
}

export const CLIENT = new ApolloClient({ uri: 'https://api.thegraph.com/subgraphs/name/streamswap/streamswap', cache: new InMemoryCache()});

export const SWAPS_FROM_ADDRESS = gql`
query GetSwapsFromAddressFromToken($address: String!) {
  user(id: $address) {
    continuousSwaps {
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

      pool {
        id
      }
  
      rateIn
      currentRateOut
      minOut
      maxOut
    }
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
    id
    name
    symbol
    decimals
  }
}`;

export const ALL_POOLS = gql`
query GetAllTokens {
  pools {
    id
    tokenAddresses
  }
}`;