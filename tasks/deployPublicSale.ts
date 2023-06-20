import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import getGasData from "../utils/getGasData";

const publicSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 10 * 60 * 1000) / 1000) //  10 minutes
    : Math.trunc((Date.now() + 5 * 60 * 1000) / 1000); // 5 minutes
const publicSaleClosingTime =
  process.env.NODE_ENV === "production"
    ? // Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000)
      Math.trunc((Date.now() + 4 * 30 * 24 * 60 * 60 * 1000) / 1000) // 4 months
    : Math.trunc((Date.now() + 1 * 60 * 60 * 1000) / 1000); // 1 hour

const investorTariff = ethers.utils.parseEther("500.0"); // 500 matic
const investorCap = ethers.utils.parseEther("50000.0"); // 50000 matic

const cliff =
  process.env.NODE_ENV === "production"
    ? 24 * 60 * 60 // 1 day after purchase
    : 3 * 60; // 3 minutes after purchase = 3 * 60 seconds locked
const vestingDuration =
  process.env.NODE_ENV === "production"
    ? 100 * 24 * 60 * 60 // 100 days linear after cliff = 100 days * 24 hours * 60 minutes * 60 seconds
    : 100 * 60; // 100 minutes linear after cliff

const initialRate = 16; // 1 MATIC = 17 BTMT
const finalRate = 5;

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

    let maxFeePerGas = ethers.utils.parseEther("0");
    let maxPriorityFeePerGas = ethers.utils.parseEther("0");

    const fees = await getGasData();
    maxFeePerGas = fees.maxFeePerGas;
    maxPriorityFeePerGas = fees.maxPriorityFeePerGas;

    const BTMT = await hre.ethers.getContractFactory("BITMarketsToken");
    const btmt = BTMT.connect(companyLiquidityWallet).attach(
      "0x247f8786C70A8CDE1df4EDDB6dE16CB926dcc408"
    );

    const PRESALE = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const preSale = PRESALE.connect(companyLiquidityWallet).attach(
      "0x5e255de70b2F825041442035eC8330FbbED96145"
    );

    const tx1 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .removeUnrestrictedReceiver(crowdsalesWallet.address, {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(
      `1) Remove presale contract from unrestricted receiver of crowdsales wallet transaction hash ${tx1.hash} with nonce ${tx1.nonce}`
    );
    await tx1.wait();

    const allowance = await btmt
      .connect(crowdsalesWallet)
      .allowance(crowdsalesWallet.address, preSale.address, {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    const tx2 = await btmt.connect(crowdsalesWallet).decreaseAllowance(preSale.address, allowance, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `2) Remove sales wallet allowance from private sale contract transaction hash ${tx2.hash} with nonce ${tx2.nonce}`
    );
    await tx2.wait();

    await new Promise((resolve) => setTimeout(resolve, 2 + Math.random() * 1000));

    const fees1 = await getGasData();
    maxFeePerGas = fees1.maxFeePerGas;
    maxPriorityFeePerGas = fees1.maxPriorityFeePerGas;

    const PUBLIC_SALE = await hre.ethers.getContractFactory("BITMarketsTokenPublicSale");
    const publicSale = await PUBLIC_SALE.connect(companyLiquidityWallet).deploy(
      {
        initialRate,
        finalRate,
        wallet: crowdsalesWallet.address,
        purchaser: crowdsalesClientPurchaserWallet.address,
        token: btmt.address,
        openingTime: publicSaleOpeningTime,
        closingTime: publicSaleClosingTime,
        investorTariff,
        investorCap,
        cliff,
        vestingDuration
      },
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    console.log(
      `3) Public sale deployment transaction hash ${publicSale.deployTransaction.hash} with nonce ${publicSale.deployTransaction.nonce}`
    );
    await publicSale.deployed();
    // const publicSale = PUBLIC_SALE.connect(companyLiquidityWallet).attach(
    //   "0xF115c943117D326aa40a9632F430029E3FE14A7E"
    // );
    console.log(`ICO_CONTRACT_ADDRESS=${publicSale.address}`);

    const fees2 = await getGasData();
    maxFeePerGas = fees2.maxFeePerGas;
    maxPriorityFeePerGas = fees2.maxPriorityFeePerGas;

    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(publicSale.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `4) Make public sale contract feeless transaction hash ${tx3.hash} with nonce ${tx3.nonce}`
    );
    await tx3.wait();

    const publicSaleCap = await btmt.balanceOf(crowdsalesWallet.address);

    const tx4 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        publicSale.address,
        ethers.utils.parseEther(`${publicSaleCap}`),
        {
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );
    console.log(
      `5) Make public sale contract an unrestricted receiver for crowdsales wallet transaction hash ${tx4.hash} with nonce ${tx4.nonce}`
    );
    await tx4.wait();

    const fees3 = await getGasData();
    maxFeePerGas = fees3.maxFeePerGas;
    maxPriorityFeePerGas = fees3.maxPriorityFeePerGas;

    const tx5 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(publicSale.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `6) Make public sale contract a feeless admin transaction hash ${tx5.hash} with nonce ${tx5.nonce}`
    );
    await tx5.wait();

    const tx6 = await btmt.connect(crowdsalesWallet).approve(publicSale.address, publicSaleCap, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `7) Give allowance to the public sale contract from the crowdsales wallet transaction hash ${tx6.hash} with nonce ${tx6.nonce}`
    );
    await tx6.wait();
  }
);
