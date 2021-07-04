import { ApolloClient, gql, InMemoryCache } from '@apollo/client';

export interface User {
  id: string
  balances: Balance[]
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

export interface Balance {
  token: Token
  balance: string
  lastAction: number
  netFlow: string
}

export const CLIENT = new ApolloClient({ uri: 'https://api.thegraph.com/subgraphs/name/streamswap/streamswap', cache: new InMemoryCache()});

export const USER_INFO = gql`
query GetUserInfo($address: String!) {
  user(id: $address) {
    id

    balances(orderBy:balance,orderDirection:desc) {
      token {
        id
        symbol
        name
        decimals
      }
      balance
      netFlow
      lastAction
    }

    continuousSwaps {
      tokenIn {
        id
        symbol
        name
        decimals
      }
      tokenOut {
        id
        symbol
        name
        decimals
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