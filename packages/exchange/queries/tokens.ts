import { gql } from '@apollo/client';

export const ALL_TOKENS = gql`
{
    tokens {
      name
      symbol
      decimals
      pools {
        id
      }
    }
  }
`;