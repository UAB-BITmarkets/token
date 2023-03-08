import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { env } from "node:process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

import dotenv from "dotenv";

import { BITMarketsTokenAllocations__factory } from "../typechain-types/factories/contracts/BITMarketsTokenAllocations__factory";

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

const allocations = BITMarketsTokenAllocations__factory.connect(
  env.ALLOCATIONS_CONTRACT_ADDRESS || "BITMarketsTokenAllocations",
  provider
);

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

    const teamWalletsLen = 1070;

    writeFileSync(join(__dirname, "teamAllocationsWallets.csv"), `PRIVATE_KEY,ADDRESS,AMOUNT`);

    for (let i = 0; i < teamWalletsLen; i++) {
      const file = readFileSync(join(__dirname, "teamAllocationsWallets.csv"), "utf8");

      const wallet = ethers.Wallet.createRandom();

      const amount = i < 10 ? 1000000 : i < 20 ? 500000 : i < 70 ? 100000 : 10000;

      writeFileSync(
        join(__dirname, "teamAllocationsWallets.csv"),
        `${file}\n${wallet.privateKey},${wallet.address},${amount}`
      );

      await allocations
        .connect(allocationsAdminWallet)
        .allocate(wallet.address, ethers.utils.parseEther(`${amount}`));

      console.log(`Allocated to ${wallet.address} amount ${amount} for team`);
    }

    const salesWalletsLen = 565;

    writeFileSync(join(__dirname, "salesAllocationsWallets.csv"), `PRIVATE_KEY,ADDRESS,AMOUNT`);

    for (let i = 0; i < salesWalletsLen; i++) {
      const file = readFileSync(join(__dirname, "salesAllocationsWallets.csv"), "utf8");

      const wallet = ethers.Wallet.createRandom();

      const amount = i < 5 ? 1000000 : i < 15 ? 500000 : i < 65 ? 100000 : 10000;

      writeFileSync(
        join(__dirname, "salesAllocationsWallets.csv"),
        `${file}\n${wallet.privateKey},${wallet.address},${amount}`
      );

      await allocations
        .connect(allocationsAdminWallet)
        .allocate(wallet.address, ethers.utils.parseEther(`${amount}`));

      console.log(`Allocated to ${wallet.address} amount ${amount} for sales`);
    }
  }
);
