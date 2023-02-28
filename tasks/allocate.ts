import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { env } from "node:process";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

import dotenv from "dotenv";

import { BITMarketsTokenAllocations__factory } from "../typechain-types/factories/contracts/BITMarketsTokenAllocations__factory";

import type { Wallet } from "ethers";

if (
  existsSync(
    join(
      dirname(".."),
      `.env_${
        process.env.NODE_ENV === "development"
          ? "dev"
          : process.env.NODE_ENV === "testing"
          ? "test"
          : "prod"
      }`
    )
  )
) {
  dotenv.config({
    path: resolve(
      dirname(".."),
      `.env_${
        process.env.NODE_ENV === "development"
          ? "dev"
          : process.env.NODE_ENV === "testing"
          ? "test"
          : "prod"
      }`
    )
  });
}

const provider =
  process.env.NODE_ENV === "development"
    ? new ethers.providers.JsonRpcProvider("HTTP://127.0.0.1:8545")
    : process.env.NODE_ENV === "testing"
    ? new ethers.providers.AlchemyProvider("maticmum", env.ALCHEMY_API_KEY || "")
    : new ethers.providers.AlchemyProvider("matic", env.ALCHEMY_API_KEY || "");

console.log(env.ALCHEMY_API_KEY);

const allocations = BITMarketsTokenAllocations__factory.connect(
  env.ALLOCATIONS_CONTRACT_ADDRESS || "BITMarketsTokenAllocations",
  provider
);

console.log(env.ALLOCATIONS_CONTRACT_ADDRESS);

const allocationsWalletTokens = 100000000;

const salesWalletsLen = 10;
const salesWallets: Wallet[] = [];
for (let i = 0; i < salesWalletsLen; i++) {
  salesWallets.push(ethers.Wallet.createRandom());
}
const salesAllocationPerWallet = (allocationsWalletTokens * 40) / 100 / salesWalletsLen;

const marketingWallet = ethers.Wallet.createRandom();
const marketingAllocation = (allocationsWalletTokens * 25) / 100;

const teamWalletsLen = 3;
const teamWallets: Wallet[] = [];
for (let i = 0; i < teamWalletsLen; i++) {
  teamWallets.push(ethers.Wallet.createRandom());
}
const teamAllocationPerWallet = (allocationsWalletTokens * 30) / 100 / teamWalletsLen;

const airdropsWalletsLen = 10;
const airdropsWallets: Wallet[] = [];
for (let i = 0; i < airdropsWalletsLen; i++) {
  airdropsWallets.push(ethers.Wallet.createRandom());
}
const airdropsAllocationPerWallet = (allocationsWalletTokens * 5) / 100 / airdropsWalletsLen;

task("allocate", "Allocate to team etc.").setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [
      companyLiquidityWallet, // needed
      allocationsWallet, // needed
      crowdsalesWallet, // needed
      companyRewardsWallet,
      esgFundWallet,
      pauserWallet,
      whitelisterWallet,
      feelessAdminWallet, // needed
      companyRestrictionWhitelistWallet, // needed
      allocationsAdminWallet, // needed
      crowdsalesClientPurchaserWallet
    ] = await hre.ethers.getSigners();

    let i = 0;

    const salesAllocationPerWalletDecimals = ethers.utils.parseEther(`${salesAllocationPerWallet}`);
    for (i = 0; i < salesWalletsLen; i++) {
      await allocations
        .connect(allocationsAdminWallet)
        .allocate(salesWallets[i].address, salesAllocationPerWalletDecimals);
    }

    const teamAllocationPerWalletDecimals = ethers.utils.parseEther(`${teamAllocationPerWallet}`);
    for (i = 0; i < teamWalletsLen; i++) {
      await allocations
        .connect(allocationsAdminWallet)
        .allocate(teamWallets[i].address, teamAllocationPerWalletDecimals);
    }

    const marketingAllocationDecimals = ethers.utils.parseEther(`${marketingAllocation}`);
    await allocations
      .connect(allocationsAdminWallet)
      .allocate(marketingWallet.address, marketingAllocationDecimals);

    const airdropsAllocationDecimals = ethers.utils.parseEther(`${airdropsAllocationPerWallet}`);
    for (i = 0; i < airdropsWalletsLen; i++) {
      await allocations
        .connect(allocationsAdminWallet)
        .allocate(airdropsWallets[i].address, airdropsAllocationDecimals);
    }
  }
);
