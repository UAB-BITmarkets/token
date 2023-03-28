import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import getGasData from "../utils/getGasData";

// const publicSaleInitialRate = 10;
// const publicSaleFinalRate = 3;

const privateSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-03-08T17:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 1 * 60 * 60 * 1000) / 1000)
    : Math.trunc((Date.now() + 2 * 60 * 1000) / 1000);
const privateSaleClosingTime = Math.trunc(new Date("2023-06-18T17:00:00").valueOf() / 1000);

// const publicSaleOpeningTime =
//   process.env.NODE_ENV === "production"
//     ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
//     : Math.trunc((Date.now() + 10 * 60 * 1000) / 1000);
// const publicSaleClosingTime = Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000);

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 10;

const companyRate = 1; // 1 over 1000 = 0.1%
const esgFundRate = 1;
const burnRate = 1;

const investorTariff = ethers.utils.parseEther("500.0"); // 500 matic
const investorCap = ethers.utils.parseEther("50000.0"); // 50000 matic

const allocationsCliff =
  process.env.NODE_ENV === "production"
    ? 9 * 30 * 24 * 60 * 60 // 9 months after purchase = 9 * 30 days * 24 hours * 60 minutes * 60 seconds locked
    : 3 * 60; // 3 minutes after purchase = 3 * 60 seconds locked
const allocationsVestingDuration =
  process.env.NODE_ENV === "production"
    ? 10 * 30 * 24 * 60 * 60 // 10 months linear after cliff = 10 * 30 days * 24 hours * 60 minutes * 60 seconds
    : 6 * 60; // 6 minutes linear after cliff = 360 seconds after cliff for full vesting

const privateSaleCliff =
  process.env.NODE_ENV === "production"
    ? 6 * 30 * 24 * 60 * 60 // 6 months after purchase = 6 * 30 days * 24 hours * 60 minutes * 60 seconds locked
    : 3 * 60; // 3 minutes after purchase = 3 * 60 seconds locked
const privateSaleVestingDuration =
  process.env.NODE_ENV === "production"
    ? 10 * 30 * 24 * 60 * 60 // 10 months linear after cliff = 10 * 30 days * 24 hours * 60 minutes * 60 seconds
    : 6 * 60; // 6 minutes linear after cliff = 360 seconds after cliff for full vesting

const whitelistedRate = 20; // 1 MATIC = 20 BTMT

task("deploy", "Deploy contracts").setAction(
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

    // const tx1 = await companyLiquidityWallet.sendTransaction({
    //   to: allocationsWallet.address,
    //   value: ethers.utils.parseEther("0.8"),
    //   maxFeePerGas,
    //   maxPriorityFeePerGas
    // });
    //
    // await tx1.wait();
    // console.log(tx1);
    //
    // const tx2 = await companyLiquidityWallet.sendTransaction({
    //   to: crowdsalesWallet.address,
    //   value: ethers.utils.parseEther("0.8"),
    //   maxFeePerGas,
    //   maxPriorityFeePerGas
    // });
    //
    // await tx2.wait();
    // console.log(tx2);

    const BTMT = await hre.ethers.getContractFactory("BITMarketsToken");
    const btmt = await BTMT.connect(companyLiquidityWallet).deploy(
      {
        initialSupply,
        finalSupply,
        allocationsWalletTokens,
        crowdsalesWalletTokens,
        maxCompanyWalletTransfer,
        companyRate,
        esgFundRate,
        burnRate,
        allocationsWallet: allocationsWallet.address,
        crowdsalesWallet: crowdsalesWallet.address,
        companyRewardsWallet: companyRewardsWallet.address,
        esgFundWallet: esgFundWallet.address,
        pauserWallet: pauserWallet.address,
        feelessAdminWallet: feelessAdminWallet.address,
        companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
      },
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    console.log(btmt);
    await btmt.deployed();
    // const btmt = BTMT.connect(companyLiquidityWallet).attach(
    //   // "0x3F008388Ba138d31C0373Fd930402f3173D09507"
    //   // "0xf1dcfbA25b8be56c4d706B0C0cf43Ae28E062688"
    //   "0x7cCC4a4759d2Bd969eAd5C1353F061873CF19B1d"
    // );

    console.log(`TOKEN_CONTRACT_ADDRESS=${btmt.address}`);

    const btmtTotalSupply = await btmt.totalSupply();

    const allocationsCap = btmtTotalSupply.div(3);

    const ALLOCATIONS = await hre.ethers.getContractFactory("BITMarketsTokenAllocations");
    const allocations = await ALLOCATIONS.connect(companyLiquidityWallet).deploy(
      allocationsWallet.address,
      allocationsAdminWallet.address,
      btmt.address,
      allocationsCliff,
      allocationsVestingDuration,
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    console.log(allocations);
    await allocations.deployed();
    // const allocations = ALLOCATIONS.connect(companyLiquidityWallet).attach(
    //   // "0xda441798840005cF8A726B711Aa54c1708bbb29d"
    //   // "0x310AD8a6a34a23330aEF455d9B730c32b12935C0"
    //   "0x34Db248d75A8F4C9FF9b5392C22Cb474b0ab3f50"
    // );

    console.log(`ALLOCATIONS_CONTRACT_ADDRESS=${allocations.address}`);

    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(allocations.address, {
      maxFeePerGas: maxFeePerGas.mul(3),
      maxPriorityFeePerGas: maxPriorityFeePerGas.mul(3)
    });
    console.log(tx3);
    await tx3.wait();
    const tx4 = await btmt.connect(feelessAdminWallet).addFeeless(allocationsWallet.address);
    console.log(tx4);
    await tx4.wait();
    if (
      (await btmt
        .connect(companyRestrictionWhitelistWallet)
        .getApprovedReceiver(companyLiquidityWallet.address)) !== allocationsWallet.address
    ) {
      const tx5 = await btmt
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(
          companyLiquidityWallet.address,
          allocationsWallet.address,
          ethers.utils.parseEther(`${allocationsWalletTokens}`),
          {
            maxFeePerGas,
            maxPriorityFeePerGas
          }
        );
      console.log(tx5);
      await tx5.wait();
    }
    const tx6 = await btmt
      .connect(companyLiquidityWallet)
      .transfer(allocationsWallet.address, ethers.utils.parseEther(`${allocationsWalletTokens}`), {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(tx6);
    await tx6.wait();
    const tx7 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        allocationsWallet.address,
        allocations.address,
        ethers.utils.parseEther(`${allocationsWalletTokens}`),
        { maxFeePerGas, maxPriorityFeePerGas }
      );
    console.log(tx7);
    await tx7.wait();
    const tx8 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(allocations.address);
    console.log(tx8);
    await tx8.wait();
    const tx9 = await btmt.connect(allocationsWallet).approve(allocations.address, allocationsCap);
    console.log(tx9);
    await tx9.wait();

    const totalSalesSupply = btmtTotalSupply.div(3);
    const privateSaleCap = totalSalesSupply.mul(4).div(10);
    // const publicSaleCap = totalSalesSupply.mul(6).div(10);

    const WHITELISTED = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const whitelisted = await WHITELISTED.connect(companyLiquidityWallet).deploy(
      {
        rate: whitelistedRate,
        wallet: crowdsalesWallet.address,
        purchaser: crowdsalesClientPurchaserWallet.address,
        token: btmt.address,
        whitelister: whitelisterWallet.address,
        openingTime: privateSaleOpeningTime,
        closingTime: privateSaleClosingTime,
        investorTariff,
        investorCap,
        cliff: privateSaleCliff,
        vestingDuration: privateSaleVestingDuration
      },
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    console.log(whitelisted);
    await whitelisted.deployed();
    // const whitelisted = WHITELISTED.connect(companyLiquidityWallet).attach(
    //   "0x22844D242cBb9B0D1DAA4af07600084d370EabB8"
    // );

    console.log(`WHITELISTED_CONTRACT_ADDRESS=${whitelisted.address}`);

    const tx10 = await btmt.connect(feelessAdminWallet).addFeeless(whitelisted.address);
    console.log(tx10);
    await tx10.wait();
    const tx11 = await btmt.connect(feelessAdminWallet).addFeeless(crowdsalesWallet.address);
    console.log(tx11);
    await tx11.wait();
    if (
      (await btmt.getApprovedReceiver(companyLiquidityWallet.address)) !== crowdsalesWallet.address
    ) {
      const tx12 = await btmt
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(
          companyLiquidityWallet.address,
          crowdsalesWallet.address,
          ethers.utils.parseEther(`${crowdsalesWalletTokens}`),
          {
            maxFeePerGas: maxFeePerGas.mul(10),
            maxPriorityFeePerGas: maxPriorityFeePerGas.mul(10)
          }
        );

      console.log(tx12);
      await tx12.wait();
    }

    const tx13 = await btmt
      .connect(companyLiquidityWallet)
      .transfer(crowdsalesWallet.address, ethers.utils.parseEther(`${crowdsalesWalletTokens}`), {
        maxFeePerGas,
        maxPriorityFeePerGas
      });

    console.log(tx13);
    await tx13.wait();

    if ((await btmt.getApprovedReceiver(crowdsalesWallet.address)) !== whitelisted.address) {
      const tx14 = await btmt
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(
          crowdsalesWallet.address,
          whitelisted.address,
          ethers.utils.parseEther(`${privateSaleCap}`),
          {
            maxFeePerGas,
            maxPriorityFeePerGas
          }
        );

      console.log(tx14);
      await tx14.wait();
    }
    const tx15 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(whitelisted.address);
    console.log(tx15);
    await tx15.wait();
    const tx16 = await btmt.connect(crowdsalesWallet).approve(whitelisted.address, privateSaleCap);
    console.log(tx16);
    await tx16.wait();

    // const PUBLIC_SALE = await hre.ethers.getContractFactory("BITMarketsTokenPublicSale");
    // const publicSale = await PUBLIC_SALE.deploy({
    //   initialRate: publicSaleInitialRate,
    //   finalRate: publicSaleFinalRate,
    //   wallet: crowdsalesWallet.address,
    //   purchaser: crowdsalesClientPurchaserWallet.address,
    //   token: btmt.address,
    //   cap: publicSaleCap,
    //   openingTime: publicSaleOpeningTime,
    //   closingTime: publicSaleClosingTime,
    //   investorTariff,
    //   investorCap,
    //   cliff,
    //   vestingDuration
    // });
    //
    // await publicSale.deployed();
    // await btmt.connect(feelessAdminWallet).addFeeless(publicSale.address);
    // await btmt
    //   .connect(companyRestrictionWhitelistWallet)
    //   .addUnrestrictedReceiver(
    //     crowdsalesWallet.address,
    //     publicSale.address,
    //     ethers.utils.parseEther(`${publicSaleCap}`)
    //   );
    // await btmt.connect(feelessAdminWallet).addFeelessAdmin(publicSale.address);
    // await btmt.connect(crowdsalesWallet).approve(publicSale.address, publicSaleCap);
    //
    // console.log(`PUBLIC_SALE_CONTRACT_ADDRESS=${publicSale.address}`);
  }
);
