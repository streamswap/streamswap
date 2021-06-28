import { gql } from '@apollo/client';

export const SWAPS_FROM_ADDRESS_FROM_TOKEN = gql`
{
    continuousSwaps(where: {user: $u, tokenIn: $u}) {
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
export const SWAPS_FROM_ADDRESS = gql`
{
    continuousSwaps(where: {user: $u, tokenIn: $u}) {
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