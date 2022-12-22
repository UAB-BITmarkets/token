import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const initialRate = 10;
const finalRate = 3;
const whitelistedCrowdsaleOpeningTime = new Date("2023-02-01T09:00:00").valueOf();
const whitelistedCrowdsaleClosingTime = new Date("2023-03-31T17:00:00").valueOf();

const icoCrowdsaleOpeningTime = new Date("2023-04-01T09:00:00").valueOf();
const icoCrowdsaleClosingTime = new Date("2023-06-23T17:00:00").valueOf();

const initialSupply = 300000000;
const companyRate = 1; // over 1000 = 0.1%
const fundRate = 1;

const investorTariff = ethers.utils.parseEther("200.0"); // 200 matic
const investorCap = ethers.utils.parseEther("10000.0"); // 10000 matic

// TODO fix cliff and vesting to happen until specific dates
const cliff = 1000; // milliseconds locked
const vestingDuration = 2000; // milliseconds after cliff for full vesting

const companyRewardsWallet = ethers.Wallet.createRandom();
const esgFundWallet = ethers.Wallet.createRandom();
const pauserWallet = ethers.Wallet.createRandom();
// const whitelisterWallet = ethers.Wallet.createRandom();

const rate = 19;
const maxWhitelisted = 100000;

task("deploy", "Deploy contracts").setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [owner] = await hre.ethers.getSigners();

    const BTMT = await hre.ethers.getContractFactory("BITMarketsToken");
    const btmt = await BTMT.deploy(
      initialSupply,
      // finalSupply,
      // burnRate,
      companyRate,
      companyRewardsWallet.address,
      fundRate,
      esgFundWallet.address, // esg fund address
      pauserWallet.address // pauser address
    );
    await btmt.deployed();

    console.log("BITMarketsToken deployed to:", btmt.address);

    const btmtTotalSupply = await btmt.totalSupply();
    const totalCrowdsalesSupply = btmtTotalSupply.div(3);
    const whitelistedCrowdsaleCap = totalCrowdsalesSupply.mul(4).div(10);
    const icoCrowdsaleCap = totalCrowdsalesSupply.mul(6).div(10);

    const WHITELISTED = await hre.ethers.getContractFactory(
      "BITMarketsTokenWhitelistedVestingCrowdsale"
    );
    const whitelisted = await WHITELISTED.deploy({
      rate,
      wallet: owner.address,
      token: btmt.address,
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
    await btmt.approve(whitelisted.address, whitelistedCrowdsaleCap);
    await btmt.addFeeless(whitelisted.address);

    console.log("BITMarketsTokenWhitelistedVestingCrowdsale deployed to:", whitelisted.address);

    const ICO = await hre.ethers.getContractFactory("BITMarketsTokenICOVestingCrowdsale");
    const ico = await ICO.deploy({
      initialRate,
      finalRate,
      wallet: owner.address,
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
    await btmt.approve(ico.address, icoCrowdsaleCap);
    await btmt.addFeeless(ico.address);

    console.log("BITMarketsTokenICOVestingCrowdsale deployed to:", ico.address);
  }
);
