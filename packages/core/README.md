Streamswap Core
====

This package contains the smart contracts, tests, and deployment utilities for the core protocol.

## Directory of Contracts

| Contract Name              | Description |
|----------------------------|-------------|
| StreamSwapFactory          | Analogous to `BFactory`. deploys `StreamSwapPool` |
| StreamSwapFactoryHelper    | Division of `StreamSwapPool` code so that the factory can be deployed |
| StreamSwapPool             | Analogous to `BPool`. Maintains a pool of Super Tokens, receives Super App calls, exposes Balancer ABI |
| StreamSwapLibrary          | Contains majority of StreamSwap core logic, including flow routing, balancer math, and storage management |

## Building and Usage

First, ensure lerna is bootstrapped.

We use hardhat to manage our builds and automation. To start up a small, fullyfledged testnet, simply run:

```
npx hardhat node &
npx hardhat deploy
```

The deployment includes Superfluid, Custom Flow Agreement, 3 tests tokens, Streamswap factory, and a testing Streamswap pool preloaded with the 3 test tokens.

## Deplyoment

Deployment to a live net can be completed using `hardhat-deploy`. A command similar to the following is used:

```
MNEUMONIC='...' ETH_RPC=https://infura... npx hardhat --network goerli deploy
```

Etherscan-verify is also available, but there have been difficulties getting it to work with some of the contracts, so its not reccomended to run for now.

## Tests

All tests are stored in the `test/` directory. They can be run with;

```
npx hardhat test
```

These tests can also be run against a live net in order to quickly test deployment integrity. For example,

```
MNEUMONIC='...' ETH_RPC=https://infura... npx hardhat --network goerli test
```

The deployments will be altered to connect to the existing superfluid contracts in the appropriate network.
