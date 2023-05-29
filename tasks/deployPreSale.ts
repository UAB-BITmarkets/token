import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import getGasData from "../utils/getGasData";

const preSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 10 * 60 * 1000) / 1000) //  10 minutes
    : Math.trunc((Date.now() + 2 * 60 * 1000) / 1000); // 2 minutes
const preSaleClosingTime =
  process.env.NODE_ENV === "production"
    ? // Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000)
      Math.trunc((Date.now() + 2 * 30 * 24 * 60 * 60 * 1000) / 1000) // 2 months
    : Math.trunc((Date.now() + 1 * 60 * 60 * 1000) / 1000); // 1 hour

const investorTariff = ethers.utils.parseEther("500.0"); // 500 matic
const investorCap = ethers.utils.parseEther("50000.0"); // 50000 matic

const cliff =
  process.env.NODE_ENV === "production"
    ? 3 * 30 * 24 * 60 * 60 // 3 months after purchase
    : 3 * 60; // 3 minutes after purchase = 3 * 60 seconds locked
const vestingDuration =
  process.env.NODE_ENV === "production"
    ? 100 * 24 * 60 * 60 // 100 days linear after cliff = 100 days * 24 hours * 60 minutes * 60 seconds
    : 100 * 60; // 100 minutes linear after cliff

const rate = 18; // 1 MATIC = 18 BTMT

task("deployPreSale", "Deploy presale contract and stop private sale").setAction(
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

    const { maxFeePerGas, maxPriorityFeePerGas } = await getGasData(); // await hre.ethers.provider.getFeeData();

    const BTMT = await hre.ethers.getContractFactory("BITMarketsToken");
    const btmt = BTMT.connect(companyLiquidityWallet).attach(
      "0xcd14236cBCf827cdd59e05588a4200762209BbD4"
    );

    const PRIVATE_SALE = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const privateSale = PRIVATE_SALE.connect(companyLiquidityWallet).attach(
      "0x931483EF29cbab74876849B0d2301A21EFd96829"
    );

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
    console.log(
      `1) Remove private sale contract from unrestricted receiver of crowdsales wallet transaction hash ${tx1.hash} with nonce ${tx1.nonce}`
    );
    await tx1.wait();

    const allowance = await btmt
      .connect(crowdsalesWallet)
      .allowance(crowdsalesWallet.address, privateSale.address);
    const tx2 = await btmt
      .connect(crowdsalesWallet)
      .decreaseAllowance(privateSale.address, allowance);
    console.log(
      `2) Remove private sale contract from unrestricted receiver of crowdsales wallet transaction hash ${tx2.hash} with nonce ${tx2.nonce}`
    );
    await tx2.wait();

    const PRE_SALE = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const preSale = await PRE_SALE.connect(companyLiquidityWallet).deploy(
      {
        rate,
        wallet: crowdsalesWallet.address,
        purchaser: crowdsalesClientPurchaserWallet.address,
        token: btmt.address,
        whitelister: whitelisterWallet.address,
        openingTime: preSaleOpeningTime,
        closingTime: preSaleClosingTime,
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
      `3) Pre sale deployment transaction hash ${preSale.deployTransaction.hash} with nonce ${preSale.deployTransaction.nonce}`
    );
    await preSale.deployed();
    // const preSale = PUBLIC_SALE.connect(companyLiquidityWallet).attach(
    //   "0xF115c943117D326aa40a9632F430029E3FE14A7E"
    // );
    console.log(`PRESALE_CONTRACT_ADDRESS=${preSale.address}`);

    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(preSale.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `4) Make presale contract feeless transaction hash ${tx3.hash} with nonce ${tx3.nonce}`
    );
    await tx3.wait();

    const preSaleCap = await btmt.balanceOf(crowdsalesWallet.address);

    const tx4 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        preSale.address,
        ethers.utils.parseEther(`${preSaleCap}`),
        {
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );
    console.log(
      `5) Make presale contract an unrestricted receiver for crowdsales wallet transaction hash ${tx4.hash} with nonce ${tx4.nonce}`
    );
    await tx4.wait();

    const tx5 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(preSale.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `6) Make presale contract a feeless admin transaction hash ${tx5.hash} with nonce ${tx5.nonce}`
    );
    await tx5.wait();

    const tx6 = await btmt.connect(crowdsalesWallet).approve(preSale.address, preSaleCap);
    console.log(
      `7) Give allowance to the presale contract from the crowdsales wallet transaction hash ${tx6.hash} with nonce ${tx6.nonce}`
    );
    await tx6.wait();
  }
);
