/** Base token definition */
export interface TokenDef {
  readonly symbol: string;
  readonly name?: string;
  readonly decimals: number;
  readonly address: string;
}

/** User token information on top of the base definition */
export interface Token extends TokenDef {
  /** Current amount of tokens this user is sending */
  outflow: number;
  /** Current amount of tokens this user is receiving */
  inflow: number;
}

/** An exchange pair of tokens for a user */
export interface TokenPair {
  tokenA: Token;
  tokenB: Token;

  /** Amount of liquidity this user has provided of TokenA */
  liquidityA: number;
  /** Amount of liquidity this user has provided of TokenB */
  liquidityB: number;

  /** Total liquidity of TokenA for this pair */
  totalLiquidityA: number;
  /** Total liquidity of TokenB for this pair */
  totalLiquidityB: number;

  /** Total fees collected over the past 24 hours for this pair */
  feesPast24Hrs: number;
}
