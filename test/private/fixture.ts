import { ethers } from "hardhat";

import type { BITMarketsToken__factory } from "../../typechain-types/factories/contracts/BITMarketsToken__factory";
import type { BITMarketsTokenPrivateSale__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenPrivateSale__factory";

export const investorTariff = ethers.utils.parseEther("100.0");
export const investorCap = ethers.utils.parseEther("4000000.0");

export const cliff = 10; // seconds locked
export const vestingDuration = 20; // seconds after cliff for full vesting

export const rate = 10;

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 20;

const companyRate = 1;
const esgFundRate = 1;
const burnRate = 1; // 1/1000 = 0.1%

export const openingTime = Date.now() + 60; // Starts in one minute
export const closingTime = openingTime + 2 * 60; // 2 minutes from start

export const loadContracts = async () => {
  const [
    companyLiquidityWallet,
    addr1,
    addr2,
    allocationsWallet,
    crowdsalesWallet,
    companyRewardsWallet,
    esgFundWallet,
    pauserWallet,
    feelessAdminWallet,
    companyRestrictionWhitelistWallet,
    whitelisterWallet,
    crowdsalesClientPurchaserWallet
  ] = await ethers.getSigners();

  const BITMarketsTokenFactory = (await ethers.getContractFactory(
    "BITMarketsToken",
    companyLiquidityWallet
  )) as BITMarketsToken__factory;

  const token = await BITMarketsTokenFactory.deploy({
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
  await token.deployed();

  const totalSupply = await token.totalSupply();
  const cap = totalSupply.div(5);

  const BITMarketsTokenPrivateSaleFactory = (await ethers.getContractFactory(
    "BITMarketsTokenPrivateSale",
    companyLiquidityWallet
  )) as BITMarketsTokenPrivateSale__factory;
  const crowdsale = await BITMarketsTokenPrivateSaleFactory.deploy({
    rate,
    wallet: crowdsalesWallet.address,
    purchaser: crowdsalesClientPurchaserWallet.address,
    token: token.address,
    whitelister: whitelisterWallet.address,
    openingTime,
    closingTime,
    investorTariff,
    investorCap,
    cliff,
    vestingDuration
  });
  await crowdsale.deployed();

  await token.connect(feelessAdminWallet).addFeeless(crowdsale.address);
  await token.connect(feelessAdminWallet).addFeeless(crowdsalesWallet.address);
  await token
    .connect(companyRestrictionWhitelistWallet)
    .addUnrestrictedReceiver(
      companyLiquidityWallet.address,
      crowdsalesWallet.address,
      ethers.utils.parseEther(`${crowdsalesWalletTokens}`)
    );
  await token.transfer(
    crowdsalesWallet.address,
    ethers.utils.parseEther(`${crowdsalesWalletTokens}`)
  );
  await token
    .connect(companyRestrictionWhitelistWallet)
    .addUnrestrictedReceiver(
      crowdsalesWallet.address,
      crowdsale.address,
      ethers.utils.parseEther(`${crowdsalesWalletTokens}`)
    );
  await token.connect(feelessAdminWallet).addFeelessAdmin(crowdsale.address);

  await token.connect(crowdsalesWallet).approve(crowdsale.address, cap);
  // await token.transfer(crowdsale.address, cap);
  // await token.increaseAllowance(crowdsale.address, cap);

  return {
    token,
    crowdsale,
    companyLiquidityWallet,
    addr1,
    addr2,
    allocationsWallet,
    crowdsalesWallet,
    companyRewardsWallet,
    esgFundWallet,
    pauserWallet,
    feelessAdminWallet,
    companyRestrictionWhitelistWallet,
    whitelisterWallet,
    crowdsalesClientPurchaserWallet
  };
};
