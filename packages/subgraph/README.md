# Subgraph
Integration with [The Graph](https://thegraph.com) inspired by the uniswap v2 subgraph.

Checkout the schema for full entity definitions and the graph docs for information on how to make
more advanced queries against them.

The basic structure is to have `Pool` which tracks `Token` and their current balances with `PooledToken`,
also swaps with `InstantSwap` and currently streamed exchanges with `ContinuousSwap` (these are
deleted when the stream of funds ends).

Historiacal data, besides being queryable with the `block` option can also be found as bucketed data
in `PoolDayData`, `PoolHourData` and `TokenDayData`.

## Build and Deploy
```
npm run build
npm run deploy
```
