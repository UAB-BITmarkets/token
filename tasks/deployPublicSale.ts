import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenPublicSale__factory } from "../typechain-types/factories/contracts/BITMarketsTokenPublicSale__factory";

import getGasData from "../utils/getGasData";

const publicSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 15 * 60 * 1000) / 1000) //  15 minutes
    : Math.trunc((Date.now() + 5 * 60 * 1000) / 1000); // 5 minutes
const publicSaleClosingTime =
  process.env.NODE_ENV === "production"
    ? // Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000)
      Math.trunc((Date.now() + (4 * 30 + 1) * 24 * 60 * 60 * 1000) / 1000) // 4 months
    : Math.trunc((Date.now() + 4 * 30 * 24 * 60 * 60 * 1000) / 1000); // 30 days

const investorTariff = ethers.parseEther("500.0"); // 500 matic
const investorCap = ethers.parseEther("500000.0"); // 500 000 matic

const cliff =
  process.env.NODE_ENV === "production"
    ? 5 * 30 * 24 * 60 * 60 // 5 months after purchase
    : 5 * 60; // 5 minutes after purchase
const vestingDuration =
  process.env.NODE_ENV === "production"
    ? 5 * 30 * 24 * 60 * 60 // 5 months linear after cliff
    : 100 * 60; // 100 minutes linear after cliff

const initialRate = 6; // 1 MATIC = 17 BTMT //TODO FINAL
const finalRate = 5; // FINAL

const provider =
  process.env.NODE_ENV === "development"
    ? new ethers.JsonRpcProvider("HTTP://127.0.0.1:8545")
    : process.env.NODE_ENV === "testing"
    ? new ethers.AlchemyProvider("maticmum", process.env.ALCHEMY_API_KEY || "")
    : new ethers.AlchemyProvider("matic", process.env.ALCHEMY_API_KEY || "");

const btmtAddress =
  process.env.NODE_ENV === "production"
    ? "0x0fCed30234C3ea94A7B47cC88006ECb7A39Dc30E"
    : "0x247f8786C70A8CDE1df4EDDB6dE16CB926dcc408";

const btmt = BITMarketsToken__factory.connect(btmtAddress, provider);

const preSaleAddress =
  process.env.NODE_ENV === "production"
    ? "0xd74468FAc200f26Cdb6825aCFdBF41E3111FbA6d"
    : "0x57e93fAe90d2c6503542F4B42D19A5f5379321E8";

task("deployPublicSale", "Deploy public sale contract and stop presale").setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [
      companyLiquidityWallet, // needed
      allocationsWallet, // needed
      crowdsalesWallet, // needed
      companyRewardsWallet,
      esgFundWallet,
      whitelisterWallet,
      feelessAdminWallet, // needed
      companyRestrictionWhitelistWallet, // needed
      allocationsAdminWallet, // needed
      crowdsalesClientPurchaserWallet
    ] = await hre.ethers.getSigners();

    let maxFeePerGas = ethers.parseEther("0");
    let maxPriorityFeePerGas = ethers.parseEther("0");

    const fees = await getGasData();
    maxFeePerGas = fees.maxFeePerGas;
    maxPriorityFeePerGas = fees.maxPriorityFeePerGas;

    const nonce1 = await companyRestrictionWhitelistWallet.getNonce();
    const tx1 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .removeUnrestrictedReceiver(crowdsalesWallet.address, {
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce: nonce1
      });
    console.log(
      `1) Remove presale contract from unrestricted receiver of crowdsales wallet transaction hash ${tx1.hash} with nonce ${tx1.nonce}`
    );
    await tx1.wait();

    const allowance = await btmt.connect(crowdsalesWallet).allowance(
      crowdsalesWallet.address,
      preSaleAddress
      // {
      //   maxFeePerGas,
      //   maxPriorityFeePerGas,
      // }
    );
    const nonce2 = await crowdsalesWallet.getNonce();
    const tx2 = await btmt.connect(crowdsalesWallet).decreaseAllowance(preSaleAddress, allowance, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: nonce2
    });
    console.log(
      `2) Remove sales wallet allowance from private sale contract transaction hash ${tx2.hash} with nonce ${tx2.nonce}`
    );
    await tx2.wait();

    await new Promise((resolve) => setTimeout(resolve, 2 + Math.random() * 1000));

    const fees1 = await getGasData();
    maxFeePerGas = fees1.maxFeePerGas;
    maxPriorityFeePerGas = fees1.maxPriorityFeePerGas;

    const nonce = await companyLiquidityWallet.getNonce();
    const PUBLIC_SALE = new BITMarketsTokenPublicSale__factory(companyLiquidityWallet);
    const publicSale = await PUBLIC_SALE.deploy(
      {
        initialRate,
        finalRate,
        wallet: crowdsalesWallet.address,
        purchaser: crowdsalesClientPurchaserWallet.address,
        token: btmtAddress,
        openingTime: publicSaleOpeningTime,
        closingTime: publicSaleClosingTime,
        investorTariff,
        investorCap,
        cliff,
        vestingDuration
      },
      {
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce
      }
    );
    const publicSaleDeployTransaction = publicSale.deploymentTransaction();
    console.log(
      `3) Public sale deployment transaction hash ${publicSaleDeployTransaction?.hash} with nonce ${publicSaleDeployTransaction?.nonce}`
    );
    await publicSale.waitForDeployment();
    // await publicSale.deployed();
    // const publicSale = PUBLIC_SALE.connect(companyLiquidityWallet).attach(
    //   "0xF115c943117D326aa40a9632F430029E3FE14A7E"
    // );
    const publicSaleAddress = await publicSale.getAddress();
    console.log(`ICO_CONTRACT_ADDRESS=${publicSaleAddress}`);

    const fees2 = await getGasData();
    maxFeePerGas = fees2.maxFeePerGas;
    maxPriorityFeePerGas = fees2.maxPriorityFeePerGas;

    const nonce3 = await feelessAdminWallet.getNonce();
    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(publicSaleAddress, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: nonce3
    });
    console.log(
      `4) Make public sale contract feeless transaction hash ${tx3.hash} with nonce ${tx3.nonce}`
    );
    await tx3.wait();

    const publicSaleCap = await btmt
      .connect(companyLiquidityWallet)
      .balanceOf(crowdsalesWallet.address);

    const nonce4 = await companyRestrictionWhitelistWallet.getNonce();
    const tx4 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        publicSaleAddress,
        ethers.parseEther(`${publicSaleCap}`),
        {
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce: nonce4
        }
      );
    console.log(
      `5) Make public sale contract an unrestricted receiver for crowdsales wallet transaction hash ${tx4.hash} with nonce ${tx4.nonce}`
    );
    await tx4.wait();

    const fees3 = await getGasData();
    maxFeePerGas = fees3.maxFeePerGas;
    maxPriorityFeePerGas = fees3.maxPriorityFeePerGas;

    const nonce5 = await feelessAdminWallet.getNonce();
    const tx5 = await btmt
      .connect(feelessAdminWallet)
      .addFeelessAdmin(await publicSale.getAddress(), {
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce: nonce5
      });
    console.log(
      `6) Make public sale contract a feeless admin transaction hash ${tx5.hash} with nonce ${tx5.nonce}`
    );
    await tx5.wait();

    const nonce6 = await crowdsalesWallet.getNonce();
    const tx6 = await btmt.connect(crowdsalesWallet).approve(publicSaleAddress, publicSaleCap, {
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce: nonce6
    });
    console.log(
      `7) Give allowance to the public sale contract from the crowdsales wallet transaction hash ${tx6.hash} with nonce ${tx6.nonce}`
    );
    await tx6.wait();
  }
);
