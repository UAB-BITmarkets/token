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

dotenvConfig({
  path: resolve(
    __dirname,
    `.env_${
      process.env.NODE_ENV === "development"
        ? "dev"
        : process.env.NODE_ENV === "production"
        ? "prod"
        : "test"
    }`
  )
});

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
    ...(process.env.NODE_ENV === "development" && {
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
        chainId: 1337, // for metamask
        mining: {
          auto: true,
          interval: 10000
        },
        gasPrice: 21
      }
    }),
    ...(process.env.NODE_ENV === "testing" && {
      polygon_mumbai: {
        url: process.env.ALCHEMY_POLYGON_MUMBAI_URL || "",
        accounts: [
          process.env.DEV_ACCOUNT_PRIVATE_KEY_1 ||
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
          process.env.DEV_ACCOUNT_PRIVATE_KEY_2 ||
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        ]
      }
    }),
    ...(process.env.NODE_ENV === "production" && {
      polygon_mumbai: {
        url: process.env.ALCHEMY_POLYGON_URL_PROD || "",
        accounts: [
          process.env.COMPANY_WALLET_PRIVATE_KEY || "",
          process.env.WHITELISTER_WALLET_PRIVATE_KEY || "",
          process.env.BLACKLISTER_WALLET_PRIVATE_KEY || ""
        ]
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
