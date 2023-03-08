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
import "./tasks/allocate";

import {
  companyLiquidityWallet,
  allocationsWallet,
  crowdsalesWallet,
  companyRewardsWallet,
  esgFundWallet,
  pauserWallet,
  whitelisterWallet,
  feelessAdminWallet,
  allocationsAdminWallet,
  companyRestrictionWhitelistWallet,
  crowdsalesClientPurchaserWallet,
  randomAccountWithLiquidity1,
  randomAccountWithLiquidity2
} from "./utils/testAccounts";

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
      // ...(process.env.NODE_ENV !== "development" && {
      optimizer: {
        enabled: true,
        runs: 1000
      }
      // })
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
            privateKey: companyLiquidityWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: randomAccountWithLiquidity1.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: randomAccountWithLiquidity2.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: allocationsWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: crowdsalesWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: companyRewardsWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: esgFundWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: pauserWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: whitelisterWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: feelessAdminWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: companyRestrictionWhitelistWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: allocationsAdminWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          },
          {
            privateKey: crowdsalesClientPurchaserWallet.privateKey,
            balance: `${10000 * 10 ** 18}`
          }
        ],
        chainId: 1337, // for metamask
        mining: {
          auto: true,
          interval: 10
        },
        gasPrice: 175000
      }
    }),
    ...(process.env.NODE_ENV === "testing" && {
      polygon_mumbai: {
        url: process.env.ALCHEMY_POLYGON_MUMBAI_URL || "",
        accounts: [
          process.env.COMPANY_LIQUIDITY_WALLET_PRIVATE_KEY || "", // needed
          process.env.ALLOCATIONS_WALLET_PRIVATE_KEY || "", // needed
          process.env.CROWDSALES_WALLET_PRIVATE_KEY || "", // needed
          process.env.COMPANY_REWARDS_WALLET_PRIVATE_KEY || "",
          process.env.ESG_FUND_WALLET_PRIVATE_KEY || "",
          process.env.PAUSER_WALLET_PRIVATE_KEY || "",
          process.env.WHITELISTER_WALLET_PRIVATE_KEY || "",
          process.env.FEELESS_ADMIN_WALLET_PRIVATE_KEY || "", // needed
          process.env.COMPANY_RESTRICTION_WHITELIST_WALLET_PRIVATE_KEY || "", // needed
          process.env.ALLOCATIONS_ADMIN_WALLET_PRIVATE_KEY || "", // needed
          process.env.CROWDSALES_CLIENT_PURCHASER_WALLET_PRIVATE_KEY || ""
        ]
      }
    }),
    ...(process.env.NODE_ENV === "production" && {
      matic: {
        url: process.env.ALCHEMY_POLYGON_MAINNET_URL || "",
        accounts: [
          process.env.COMPANY_LIQUIDITY_WALLET_PRIVATE_KEY || "", // needed
          process.env.ALLOCATIONS_WALLET_PRIVATE_KEY || "", // needed
          process.env.CROWDSALES_WALLET_PRIVATE_KEY || "", // needed
          process.env.COMPANY_REWARDS_WALLET_PRIVATE_KEY || "",
          process.env.ESG_FUND_WALLET_PRIVATE_KEY || "",
          process.env.PAUSER_WALLET_PRIVATE_KEY || "",
          process.env.WHITELISTER_WALLET_PRIVATE_KEY || "",
          process.env.FEELESS_ADMIN_WALLET_PRIVATE_KEY || "", // needed
          process.env.COMPANY_RESTRICTION_WHITELIST_WALLET_PRIVATE_KEY || "", // needed
          process.env.ALLOCATIONS_ADMIN_WALLET_PRIVATE_KEY || "", // needed
          process.env.CROWDSALES_CLIENT_PURCHASER_WALLET_PRIVATE_KEY || ""
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
  ...(process.env.LEVEL === "testing" && {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY
    }
  })
};

export default config;
