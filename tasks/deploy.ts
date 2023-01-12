import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const icoInitialRate = 10;
const icoFinalRate = 3;
const whitelistedCrowdsaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? Math.trunc(new Date(`2023-02-01T09:00:00`).valueOf() / 1000)
    : Math.trunc((Date.now() + 60 * 1000) / 1000);
const whitelistedCrowdsaleClosingTime = Math.trunc(
  new Date("2023-06-30T17:00:00").valueOf() / 1000
);

const icoCrowdsaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
    : Math.trunc((Date.now() + 60 * 1000) / 1000);
const icoCrowdsaleClosingTime = Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000);

const initialSupply = 300000000;
const companyRate = 1; // over 1000 = 0.1%
const fundRate = 1;

const investorTariff = ethers.utils.parseEther("100.0"); // 100 matic
const investorCap = ethers.utils.parseEther("30000.0"); // 30000 matic

// TODO fix cliff and vesting to happen until specific dates
const cliff = 60 * 1000; // one minute = 60000 milliseconds locked
const vestingDuration = 60 * 1000; // one minute = 60000 milliseconds after cliff for full vesting

const companyRewardsWallet = ethers.Wallet.createRandom();
const esgFundWallet = ethers.Wallet.createRandom();
const pauserWallet = ethers.Wallet.createRandom();
// const whitelisterWallet = ethers.Wallet.createRandom();

const whitelistedRate = 19;
const maxWhitelisted = 100000;

task("deploy", "Deploy contracts").setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [owner, whitelister] = await hre.ethers.getSigners();

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

    console.log("TOKEN_CONTRACT_ADDRESS=", btmt.address);

    const btmtTotalSupply = await btmt.totalSupply();
    const totalCrowdsalesSupply = btmtTotalSupply.div(3);
    const whitelistedCrowdsaleCap = totalCrowdsalesSupply.mul(4).div(10);
    const icoCrowdsaleCap = totalCrowdsalesSupply.mul(6).div(10);

    const WHITELISTED = await hre.ethers.getContractFactory(
      "BITMarketsTokenWhitelistedVestingCrowdsale"
    );
    const whitelisted = await WHITELISTED.deploy({
      rate: whitelistedRate,
      wallet: owner.address,
      token: btmt.address,
      whitelister: whitelister.address,
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

    console.log("WHITELISTED_CONTRACT_ADDRESS=", whitelisted.address);

    const ICO = await hre.ethers.getContractFactory("BITMarketsTokenICOVestingCrowdsale");
    const ico = await ICO.deploy({
      initialRate: icoInitialRate,
      finalRate: icoFinalRate,
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

    console.log("ICO_CONTRACT_ADDRESS=", ico.address);
  }
);
