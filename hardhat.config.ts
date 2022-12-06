// import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { HardhatUserConfig } from "hardhat/config";
// import { NetworkUserConfig } from 'hardhat/types';
// import '@nomiclabs/hardhat-web3';

import "./tasks/deploy";

dotenvConfig({ path: resolve(__dirname, ".env.dev") });

// const chainIds = {
//   'arbitrum-mainnet': 42161,
//   avalanche: 43114,
//   bsc: 56,
//   hardhat: 31337,
//   mainnet: 1,
//   'optimism-mainnet': 10,
//   'polygon-mainnet': 137,
//   'polygon-mumbai': 80001,
//   rinkeby: 4
// };

// const getChainConfig = (chain: keyof typeof chainIds): NetworkUserConfig => {
//   let jsonRpcUrl: string;
//   switch (chain) {
//     case 'avalanche':
//       jsonRpcUrl = 'https://api.avax.network/ext/bc/C/rpc';
//       break;
//     case 'bsc':
//       jsonRpcUrl = 'https://bsc-dataseed1.binance.org';
//       break;
//     default:
//       jsonRpcUrl = 'https://' + chain + '.infura.io/v3/' + infuraApiKey;
//   }
//
//   return {
//     accounts: {
//       count: 10,
//       mnemonic,
//       path: "m/44'/60'/0'/0"
//     },
//     chainId: chainIds[chain],
//     url: jsonRpcUrl
//   };
// };

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.14",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none"
      },
      ...(process.env.PRODUCTION === "true" && {
        optimizer: {
          enabled: true,
          runs: 800
        }
      })
    }
  },
  paths: {
    artifacts: "./frontend/src/artifacts"
  },
  networks: {
    ...(process.env.LEVEL === "dev" && {
      hardhat: {
        accounts: [
          {
            privateKey:
              process.env.DEV_ACCOUNT_PRIVATE_KEY_1 ||
              "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            balance: "10000000000000000000000"
          },
          {
            privateKey:
              process.env.DEV_ACCOUNT_PRIVATE_KEY_2 ||
              "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
            balance: "10000000000000000000000"
          },
          {
            privateKey:
              process.env.DEV_ACCOUNT_PRIVATE_KEY_3 ||
              "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
            balance: "10000000000000000000000"
          }
        ],
        chainId: 1337 // for metamask
        // mining: {
        //   auto: false,
        //   interval: 1000
        // },
        // gasPrice: 2100000
      }
    }),
    ...(process.env.LEVEL === "test" && {
      ropsten: {
        url: process.env.ROPSTEN_URL || "",
        accounts:
          process.env.TEST_ACCOUNT_PRIVATE_KEY !== undefined
            ? [process.env.TEST_ACCOUNT_PRIVATE_KEY]
            : []
      },
      polygon_mumbai: {
        url: process.env.POLYGON_MUMBAI_URL || "",
        accounts:
          process.env.TEST_ACCOUNT_PRIVATE_KEY !== undefined
            ? [process.env.TEST_ACCOUNT_PRIVATE_KEY]
            : []
      }
    })
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "EUR"
  },
  mocha: {
    timeout: 60000
  },
  ...(process.env.LEVEL === "test" && {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY
    }
  })
};

export default config;
