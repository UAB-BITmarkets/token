import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// const publicSaleInitialRate = 10;
// const publicSaleFinalRate = 3;

const privateSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? Math.trunc(new Date(`2023-02-15T09:00:00`).valueOf() / 1000)
    : Math.trunc((Date.now() + 2 * 60 * 1000) / 1000);
const privateSaleClosingTime = Math.trunc(new Date("2023-06-26T17:00:00").valueOf() / 1000);

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

const companyRate = 10; // 1 over 1000 = 0.1%
const esgFundRate = 10;
const burnRate = 10;

const investorTariff = ethers.utils.parseEther("500.0"); // 500 matic
const investorCap = ethers.utils.parseEther("50000.0"); // 50000 matic

const cliff = 180; // three minutes = 180 seconds locked
const vestingDuration = 360; // six minute = 360 seconds after cliff for full vesting

const whitelistedRate = 20;

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

    const BTMT = await hre.ethers.getContractFactory("BITMarketsToken");
    const btmt = await BTMT.connect(companyLiquidityWallet).deploy({
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
    });
    await btmt.deployed();

    console.log(`TOKEN_CONTRACT_ADDRESS=${btmt.address}`);

    const btmtTotalSupply = await btmt.totalSupply();

    const allocationsCap = btmtTotalSupply.div(3);

    const ALLOCATIONS = await hre.ethers.getContractFactory("BITMarketsTokenAllocations");
    const allocations = await ALLOCATIONS.connect(companyLiquidityWallet).deploy(
      allocationsWallet.address,
      allocationsAdminWallet.address,
      btmt.address,
      cliff,
      vestingDuration
    );
    await allocations.deployed();

    await btmt.connect(feelessAdminWallet).addFeeless(allocations.address);
    await btmt.connect(feelessAdminWallet).addFeeless(allocationsWallet.address);
    await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        companyLiquidityWallet.address,
        allocationsWallet.address,
        ethers.utils.parseEther(`${allocationsWalletTokens}`)
      );
    await btmt
      .connect(companyLiquidityWallet)
      .transfer(allocationsWallet.address, ethers.utils.parseEther(`${allocationsWalletTokens}`));

    await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        allocationsWallet.address,
        allocations.address,
        ethers.utils.parseEther(`${allocationsWalletTokens}`)
      );
    await btmt.connect(feelessAdminWallet).addFeelessAdmin(allocations.address);
    await btmt.connect(allocationsWallet).approve(allocations.address, allocationsCap);

    console.log(`ALLOCATIONS_CONTRACT_ADDRESS=${allocations.address}`);

    const totalSalesSupply = btmtTotalSupply.div(3);
    const privateSaleCap = totalSalesSupply.mul(4).div(10);
    // const publicSaleCap = totalSalesSupply.mul(6).div(10);

    const WHITELISTED = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const whitelisted = await WHITELISTED.connect(companyLiquidityWallet).deploy({
      rate: whitelistedRate,
      wallet: crowdsalesWallet.address,
      purchaser: crowdsalesClientPurchaserWallet.address,
      token: btmt.address,
      whitelister: whitelisterWallet.address,
      openingTime: privateSaleOpeningTime,
      closingTime: privateSaleClosingTime,
      investorTariff,
      investorCap,
      cliff,
      vestingDuration
    });
    await whitelisted.deployed();

    await btmt.connect(feelessAdminWallet).addFeeless(whitelisted.address);
    await btmt.connect(feelessAdminWallet).addFeeless(crowdsalesWallet.address);
    await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        companyLiquidityWallet.address,
        crowdsalesWallet.address,
        ethers.utils.parseEther(`${crowdsalesWalletTokens}`)
      );
    await btmt
      .connect(companyLiquidityWallet)
      .transfer(crowdsalesWallet.address, ethers.utils.parseEther(`${crowdsalesWalletTokens}`));

    await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        whitelisted.address,
        ethers.utils.parseEther(`${privateSaleCap}`)
      );
    await btmt.connect(feelessAdminWallet).addFeelessAdmin(whitelisted.address);
    await btmt.connect(crowdsalesWallet).approve(whitelisted.address, privateSaleCap);

    console.log(`WHITELISTED_CONTRACT_ADDRESS=${whitelisted.address}`);

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
