import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import getGasData from "../utils/getGasData";

const publicSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 1 * 60 * 60 * 1000) / 1000)
    : Math.trunc((Date.now() + 2 * 60 * 1000) / 1000);
const publicSaleClosingTime =
  process.env.NODE_ENV === "production"
    ? Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000)
    : Math.trunc((Date.now() + 1 * 60 * 60 * 1000) / 1000);

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

const initialRate = 17; // 1 MATIC = 17 BTMT
const finalRate = 5;

task("deployPublicSale", "Deploy public sale contract and stop private sale").setAction(
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

    const { maxFeePerGas, maxPriorityFeePerGas } = await getGasData(); // await hre.ethers.provider.getFeeData();

    const BTMT = await hre.ethers.getContractFactory("BITMarketsToken");
    const btmt = BTMT.connect(companyLiquidityWallet).attach(
      "0xcd14236cBCf827cdd59e05588a4200762209BbD4"
    );

    console.log(`TOKEN_CONTRACT_ADDRESS=${btmt.address}`);

    const WHITELISTED = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const whitelisted = WHITELISTED.connect(companyLiquidityWallet).attach(
      "0x931483EF29cbab74876849B0d2301A21EFd96829"
    );

    console.log(`WHITELISTED_CONTRACT_ADDRESS=${whitelisted.address}`);

    // const WHITELISTED = await hre.ethers.getContractFactory("BITMarketsTokenPublicSale");
    // const whitelisted = WHITELISTED.connect(companyLiquidityWallet).attach(
    //   "0xF115c943117D326aa40a9632F430029E3FE14A7E"
    // );
    //
    // console.log(`WHITELISTED_CONTRACT_ADDRESS=${whitelisted.address}`);

    const tx1 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .removeUnrestrictedReceiver(crowdsalesWallet.address, {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(tx1);
    await tx1.wait();

    const allowance = await btmt
      .connect(crowdsalesWallet)
      .allowance(crowdsalesWallet.address, whitelisted.address);
    const tx2 = await btmt
      .connect(crowdsalesWallet)
      .decreaseAllowance(whitelisted.address, allowance);
    console.log(tx2);
    await tx2.wait();

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
    console.log(publicSale);
    await publicSale.deployed();
    // const publicSale = PUBLIC_SALE.connect(companyLiquidityWallet).attach(
    //   "0xF115c943117D326aa40a9632F430029E3FE14A7E"
    // );
    console.log(`ICO_CONTRACT_ADDRESS=${publicSale.address}`);

    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(publicSale.address);
    console.log(tx3);
    await tx3.wait();

    const publicSaleCap = await btmt.balanceOf(crowdsalesWallet.address);

    const tx4 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        publicSale.address,
        ethers.utils.parseEther(`${publicSaleCap}`)
      );
    console.log(tx4);
    await tx4.wait();

    const tx5 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(publicSale.address);
    console.log(tx5);
    await tx5.wait();

    const tx6 = await btmt.connect(crowdsalesWallet).approve(publicSale.address, publicSaleCap);
    console.log(tx6);
    await tx6.wait();
  }
);
