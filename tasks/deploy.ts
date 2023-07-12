import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import getGasData from "../utils/getGasData";

const privateSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-03-08T17:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 15 * 60 * 1000) / 1000) // 15 minutes
    : Math.trunc((Date.now() + 5 * 60 * 1000) / 1000); // 5 minutes
// const privateSaleClosingTime = Math.trunc(new Date("2023-06-18T17:00:00").valueOf() / 1000);
const privateSaleClosingTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-03-08T17:00:00`).valueOf() / 1000)
      // Math.trunc((Date.now() + 10 * 60 * 1000) / 1000) // 10 minutes
      Math.trunc((Date.now() + 20 * 24 * 60 * 60 * 1000) / 1000) // 20 days
    : Math.trunc((Date.now() + 1 * 30 * 24 * 60 * 60 * 1000) / 1000); // 1 month

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
    : 10 * 60; // 10 minutes after purchase = 10 * 60 seconds locked
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
        feelessAdminWallet: feelessAdminWallet.address,
        companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
      },
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    console.log(
      `1) Token deployment transaction hash ${btmt.deployTransaction.hash} with nonce ${btmt.deployTransaction.nonce}`
    );
    await btmt.deployed();
    // const btmt = BTMT.connect(companyLiquidityWallet).attach(
    //   process.env.NODE_ENV === "production"
    //     ? "0xa0c91763732a2AceEAbcb7328A88368C250a9a9B"
    //     : "0xa0c91763732a2AceEAbcb7328A88368C250a9a9B"
    // );

    console.log(`TOKEN_CONTRACT_ADDRESS=${btmt.address}`);

    const btmtTotalSupply = await btmt.totalSupply();

    const allocationsCap = btmtTotalSupply.div(3);

    const fees1 = await getGasData();
    maxFeePerGas = fees1.maxFeePerGas;
    maxPriorityFeePerGas = fees1.maxPriorityFeePerGas;

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
    console.log(
      `2) Allocations contract deployment transaction hash ${allocations.deployTransaction.hash} with nonce ${allocations.deployTransaction.nonce}`
    );
    await allocations.deployed();
    // const allocations = ALLOCATIONS.connect(companyLiquidityWallet).attach(
    //   // "0xda441798840005cF8A726B711Aa54c1708bbb29d"
    //   // "0x310AD8a6a34a23330aEF455d9B730c32b12935C0"
    //   "0x34Db248d75A8F4C9FF9b5392C22Cb474b0ab3f50"
    // );

    console.log(`ALLOCATIONS_CONTRACT_ADDRESS=${allocations.address}`);

    const fees2 = await getGasData();
    maxFeePerGas = fees2.maxFeePerGas;
    maxPriorityFeePerGas = fees2.maxPriorityFeePerGas;

    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(allocations.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `3) Make allocations contract feeless transaction hash ${tx3.hash} with nonce ${tx3.nonce}`
    );
    await tx3.wait();

    const tx4 = await btmt.connect(feelessAdminWallet).addFeeless(allocationsWallet.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `4) Make allocations wallet feeless transaction hash ${tx4.hash} with nonce ${tx4.nonce}`
    );
    await tx4.wait();

    // if (
    //   (await btmt
    //     .connect(companyRestrictionWhitelistWallet)
    //     .getApprovedReceiver(companyLiquidityWallet.address)) !== allocationsWallet.address
    // ) {
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
    console.log(
      `5) Make allocations wallet an unrestricted receiver for company liquidity transaction hash ${tx5.hash} with nonce ${tx5.nonce}`
    );
    await tx5.wait();
    // }

    const tx6 = await btmt
      .connect(companyLiquidityWallet)
      .transfer(allocationsWallet.address, ethers.utils.parseEther(`${allocationsWalletTokens}`), {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(
      `6) Do the unrestricted transfer from liquidity to allocations wallet transaction hash ${tx6.hash} with nonce ${tx6.nonce}`
    );
    await tx6.wait();

    const tx7 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        allocationsWallet.address,
        allocations.address,
        ethers.utils.parseEther(`${allocationsWalletTokens}`),
        { maxFeePerGas, maxPriorityFeePerGas }
      );
    console.log(
      `7) Make allocations contract an unrestricted receiver for allocations wallet transaction hash ${tx7.hash} with nonce ${tx7.nonce}`
    );
    await tx7.wait();

    const tx8 = await btmt
      .connect(feelessAdminWallet)
      .addFeelessAdmin(allocations.address, { maxFeePerGas, maxPriorityFeePerGas });
    console.log(
      `8) Make allocations contract a feeless admin transaction hash ${tx8.hash} with nonce ${tx8.nonce}`
    );
    await tx8.wait();

    const tx9 = await btmt
      .connect(allocationsWallet)
      .approve(allocations.address, allocationsCap, { maxFeePerGas, maxPriorityFeePerGas });
    console.log(
      `9) Give allowance to the allocations contract from the allocations wallet transaction hash ${tx9.hash} with nonce ${tx9.nonce}`
    );
    await tx9.wait();

    const fees3 = await getGasData();
    maxFeePerGas = fees3.maxFeePerGas;
    maxPriorityFeePerGas = fees3.maxPriorityFeePerGas;

    const totalSalesSupply = btmtTotalSupply.div(3);
    const privateSaleCap = totalSalesSupply.mul(4).div(10);
    // const publicSaleCap = totalSalesSupply.mul(6).div(10);

    const PRIVATE_SALE = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const privateSale = await PRIVATE_SALE.connect(companyLiquidityWallet).deploy(
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
    console.log(
      `10) Private sale deployment transaction hash ${privateSale.deployTransaction.hash} with nonce ${privateSale.deployTransaction.nonce}`
    );
    await privateSale.deployed();
    // const whitelisted = WHITELISTED.connect(companyLiquidityWallet).attach(
    //   "0x22844D242cBb9B0D1DAA4af07600084d370EabB8"
    // );

    console.log(`WHITELISTED_CONTRACT_ADDRESS=${privateSale.address}`);

    const fees4 = await getGasData();
    maxFeePerGas = fees4.maxFeePerGas;
    maxPriorityFeePerGas = fees4.maxPriorityFeePerGas;

    const tx10 = await btmt.connect(feelessAdminWallet).addFeeless(privateSale.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `11) Make private sale contract feeless transaction hash ${tx10.hash} with nonce ${tx10.nonce}`
    );
    await tx10.wait();

    const tx11 = await btmt.connect(feelessAdminWallet).addFeeless(crowdsalesWallet.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `12) Make crowdsales wallet feeless transaction hash ${tx11.hash} with nonce ${tx11.nonce}`
    );
    await tx11.wait();

    // if (
    //   (await btmt.getApprovedReceiver(companyLiquidityWallet.address)) !== crowdsalesWallet.address
    // ) {
    const tx12 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        companyLiquidityWallet.address,
        crowdsalesWallet.address,
        ethers.utils.parseEther(`${crowdsalesWalletTokens}`),
        {
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );
    console.log(
      `13) Make crowdsales wallet an unrestricted receiver for company liquidity transaction hash ${tx12.hash} with nonce ${tx12.nonce}`
    );
    await tx12.wait();
    // }

    const tx13 = await btmt
      .connect(companyLiquidityWallet)
      .transfer(crowdsalesWallet.address, ethers.utils.parseEther(`${crowdsalesWalletTokens}`), {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(
      `14) Do the unrestricted transfer from liquidity to crowdsales wallet transaction hash ${tx13.hash} with nonce ${tx13.nonce}`
    );
    await tx13.wait();

    // if ((await btmt.getApprovedReceiver(crowdsalesWallet.address)) !== whitelisted.address) {
    const tx14 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(crowdsalesWallet.address, privateSale.address, privateSaleCap, {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(
      `15) Make private sale contract an unrestricted receiver for crowdsales wallet transaction hash ${tx14.hash} with nonce ${tx14.nonce}`
    );
    await tx14.wait();
    // }

    const tx15 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(privateSale.address, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `16) Make private sale contract a feeless admin transaction hash ${tx15.hash} with nonce ${tx15.nonce}`
    );
    await tx15.wait();

    const tx16 = await btmt.connect(crowdsalesWallet).approve(privateSale.address, privateSaleCap, {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `17) Give allowance to the private sale contract from the crowdsales wallet transaction hash ${tx16.hash} with nonce ${tx16.nonce}`
    );
    await tx16.wait();
  }
);
