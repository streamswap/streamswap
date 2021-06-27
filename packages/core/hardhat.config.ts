import { task } from 'hardhat/config';

import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';

import 'hardhat-gas-reporter';
import 'hardhat-deploy';

import { HardhatUserConfig } from 'hardhat/types';

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_, bre) => {
  const accounts = await bre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const hhConfig: HardhatUserConfig = {
  defaultNetwork: 'hardhat',

  paths: {
    deploy: 'deploy/test'
  },

  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: process.env['MNEMONIC'] ||'enrich genius online man glue impact narrow exact veteran real fiction affair'
      },
      deploy: process.env['ETH_RPC'] ? [
        'deploy/common',
        'deploy/goerli'
      ] : ['deploy/test'],
      forking: process.env['ETH_RPC'] ? {
        url: process.env['ETH_RPC']
      } : undefined
    },
    goerli: {
      live: true,
      saveDeployments: true,
      deploy: [
        'deploy/common',
        'deploy/goerli'
      ],
      url: process.env['ETH_RPC'] || 'http://goerli-eth.k8s:8545',
      accounts: {
        mnemonic: process.env['MNEMONIC'] ||'enrich genius online man glue impact narrow exact veteran real fiction affair'
      },
    },
    mainnet: {
      live: true,
      url: process.env['ETH_RPC'] || 'http://eth.k8s:8545'
    }
  },

  typechain: {
    target: 'ethers-v5',
    outDir: './generated/typechain'
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        }
      },
      {
        version: "0.5.12"
      }
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env['ETHERSCAN_API_KEY'] || ''
  },
  namedAccounts: {
    deployer: {
      default: 0
    },

    dummy: {
      default: 1
    }
  },
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21
  }
};

module.exports = hhConfig;
