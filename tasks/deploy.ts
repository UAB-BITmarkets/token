import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// import type { Wallet } from "ethers";

const icoInitialRate = 10;
const icoFinalRate = 3;
const whitelistedCrowdsaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? Math.trunc(new Date(`2023-02-15T09:00:00`).valueOf() / 1000)
    : Math.trunc((Date.now() + 60 * 1000) / 1000);
const whitelistedCrowdsaleClosingTime = Math.trunc(
  new Date("2023-06-26T17:00:00").valueOf() / 1000
);

const icoCrowdsaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
    : Math.trunc((Date.now() + 60 * 1000) / 1000);
const icoCrowdsaleClosingTime = Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000);

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 10;

const companyRate = 1; // over 1000 = 0.1%
const esgFundRate = 1;
const burnRate = 1;

const investorTariff = ethers.utils.parseEther("100.0"); // 100 matic
const investorCap = ethers.utils.parseEther("30000.0"); // 30000 matic

const cliff = 60; // one minute = 60 seconds locked
const vestingDuration = 60; // one minute = 60 seconds after cliff for full vesting

const whitelistedRate = 19;
const maxWhitelisted = 100000;

// const salesWalletsLen = 1000;
// const salesWallets: Wallet[] = [];
// for (let i = 0; i < salesWalletsLen; i++) {
//   salesWallets.push(ethers.Wallet.createRandom());
// }
// const salesAllocationPerWallet = (allocationsWalletTokens * 40) / 100 / salesWalletsLen;
//
// const marketingWallet = ethers.Wallet.createRandom();
// const marketingAllocation = (allocationsWalletTokens * 25) / 100;
//
// const teamWalletsLen = 3;
// const teamWallets: Wallet[] = [];
// for (let i = 0; i < teamWalletsLen; i++) {
//   teamWallets.push(ethers.Wallet.createRandom());
// }
// const teamAllocationPerWallet = (allocationsWalletTokens * 30) / 100 / teamWalletsLen;
//
// const airdropsWalletsLen = 100;
// const airdropsWallets: Wallet[] = [];
// for (let i = 0; i < airdropsWalletsLen; i++) {
//   airdropsWallets.push(ethers.Wallet.createRandom());
// }
// const airdropsAllocationPerWallet = (allocationsWalletTokens * 5) / 100 / airdropsWalletsLen;

task("deploy", "Deploy contracts").setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [
      companyLiquidityWallet, // needed
      allocationsWallet, // needed
      crowdsalesWallet, // needed
      companyRewardsWallet,
      esgFundWallet,
      minterWallet,
      pauserWallet,
      whitelisterWallet,
      blacklisterWallet,
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
      minterWallet: minterWallet.address,
      pauserWallet: pauserWallet.address,
      blacklisterWallet: blacklisterWallet.address,
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

    // let i = 0;
    //
    // const salesAllocationPerWalletDecimals = ethers.utils.parseEther(`${salesAllocationPerWallet}`);
    // for (i = 0; i < salesWalletsLen; i++) {
    //   await allocations
    //     .connect(allocationsAdminWallet)
    //     .allocate(salesWallets[i].address, salesAllocationPerWalletDecimals);
    // }
    //
    // const teamAllocationPerWalletDecimals = ethers.utils.parseEther(`${teamAllocationPerWallet}`);
    // for (i = 0; i < teamWalletsLen; i++) {
    //   await allocations
    //     .connect(allocationsAdminWallet)
    //     .allocate(teamWallets[i].address, teamAllocationPerWalletDecimals);
    // }
    //
    // const marketingAllocationDecimals = ethers.utils.parseEther(`${marketingAllocation}`);
    // await allocations
    //   .connect(allocationsAdminWallet)
    //   .allocate(marketingWallet.address, marketingAllocationDecimals);
    //
    // const airdropsAllocationDecimals = ethers.utils.parseEther(`${airdropsAllocationPerWallet}`);
    // for (i = 0; i < airdropsWalletsLen; i++) {
    //   await allocations
    //     .connect(allocationsAdminWallet)
    //     .allocate(airdropsWallets[i].address, airdropsAllocationDecimals);
    // }

    const totalCrowdsalesSupply = btmtTotalSupply.div(3);
    const whitelistedCrowdsaleCap = totalCrowdsalesSupply.mul(4).div(10);
    const icoCrowdsaleCap = totalCrowdsalesSupply.mul(6).div(10);

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

    const WHITELISTED = await hre.ethers.getContractFactory(
      "BITMarketsTokenWhitelistedVestingCrowdsale"
    );
    const whitelisted = await WHITELISTED.connect(companyLiquidityWallet).deploy({
      rate: whitelistedRate,
      wallet: crowdsalesWallet.address,
      purchaser: crowdsalesClientPurchaserWallet.address,
      token: btmt.address,
      whitelister: whitelisterWallet.address,
      cap: whitelistedCrowdsaleCap,
      maxWhitelisted,
      openingTime: whitelistedCrowdsaleOpeningTime,
      closingTime: whitelistedCrowdsaleClosingTime,
      investorTariff,
      investorCap,
      cliff,
      vestingDuration
    });

    await whitelisted.deployed();
    await btmt.connect(feelessAdminWallet).addFeeless(whitelisted.address);
    await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        whitelisted.address,
        ethers.utils.parseEther(`${whitelistedCrowdsaleCap}`)
      );
    await btmt.connect(feelessAdminWallet).addFeelessAdmin(whitelisted.address);
    await btmt.connect(crowdsalesWallet).approve(whitelisted.address, whitelistedCrowdsaleCap);

    console.log(`WHITELISTED_CONTRACT_ADDRESS=${whitelisted.address}`);

    const ICO = await hre.ethers.getContractFactory("BITMarketsTokenICOVestingCrowdsale");
    const ico = await ICO.deploy({
      initialRate: icoInitialRate,
      finalRate: icoFinalRate,
      wallet: crowdsalesWallet.address,
      purchaser: crowdsalesClientPurchaserWallet.address,
      token: btmt.address,
      cap: icoCrowdsaleCap,
      openingTime: icoCrowdsaleOpeningTime,
      closingTime: icoCrowdsaleClosingTime,
      investorTariff,
      investorCap,
      cliff,
      vestingDuration
    });

    await ico.deployed();
    await btmt.connect(feelessAdminWallet).addFeeless(ico.address);
    await btmt
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        crowdsalesWallet.address,
        ico.address,
        ethers.utils.parseEther(`${icoCrowdsaleCap}`)
      );
    await btmt.connect(feelessAdminWallet).addFeelessAdmin(ico.address);
    await btmt.connect(crowdsalesWallet).approve(ico.address, icoCrowdsaleCap);

    console.log(`ICO_CONTRACT_ADDRESS=${ico.address}`);
  }
);
