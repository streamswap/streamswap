import { gql } from '@apollo/client';

export interface User {
  id: string
  continuousSwaps: ContinuousSwap[]
}

export interface Token {
  symbol: string
  name: string
  decimals: number
}

export interface ContinuousSwap {
  tokenIn: Token
  tokenOut: Token
  rateIn: string
}

export const SWAPS_FROM_ADDRESS_FROM_TOKEN = gql`
query GetSwapsFromAddressFromToken(address: String!, tokenIn: String!) {
    continuousSwaps(where: {user: $address, tokenIn: $tokenIn}) {
      user {
        
      }
      tokenIn {

      }
      tokenOut {

      }

      rateIn
    }
  }
`;
export const USER_INFO = gql`
query GetUserInfo(address: String!) {
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
  }
`;