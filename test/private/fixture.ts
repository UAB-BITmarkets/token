import { ethers } from "hardhat";

import { BITMarketsToken__factory } from "../../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenPrivateSale__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenPrivateSale__factory";

export const investorTariff = ethers.parseEther("500.0"); // 500 matic
export const investorCap = ethers.parseEther("50000.0"); // 50000 matic

export const cliff = 10; // seconds locked
export const vestingDuration = 20; // seconds after cliff for full vesting

export const rate = 20;

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
export const closingTime = openingTime + 3 * 60; // 2 minutes from start

export const loadContracts = async () => {
  const [
    companyLiquidityWallet,
    addr1,
    addr2,
    allocationsWallet,
    crowdsalesWallet,
    companyRewardsWallet,
    esgFundWallet,
    feelessAdminWallet,
    companyRestrictionWhitelistWallet,
    whitelisterWallet,
    crowdsalesClientPurchaserWallet
  ] = await ethers.getSigners();

  const BITMarketsTokenFactory = new BITMarketsToken__factory(companyLiquidityWallet);
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
    feelessAdminWallet: feelessAdminWallet.address,
    companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
  });
  await token.waitForDeployment();

  const totalSupply = await token.totalSupply();
  const cap = totalSupply / BigInt(5);

  const BITMarketsTokenPrivateSaleFactory = new BITMarketsTokenPrivateSale__factory(
    companyLiquidityWallet
  );
  const crowdsale = await BITMarketsTokenPrivateSaleFactory.deploy({
    rate,
    wallet: crowdsalesWallet.address,
    purchaser: crowdsalesClientPurchaserWallet.address,
    token: token.getAddress(),
    whitelister: whitelisterWallet.address,
    openingTime,
    closingTime,
    investorTariff,
    investorCap,
    cliff,
    vestingDuration
  });
  await crowdsale.waitForDeployment();

  await token.connect(feelessAdminWallet).addFeeless(await crowdsale.getAddress());
  await token.connect(feelessAdminWallet).addFeeless(crowdsalesWallet.address);
  await token
    .connect(companyRestrictionWhitelistWallet)
    .addUnrestrictedReceiver(
      companyLiquidityWallet.address,
      crowdsalesWallet.address,
      ethers.parseEther(`${crowdsalesWalletTokens}`)
    );
  await token.transfer(crowdsalesWallet.address, ethers.parseEther(`${crowdsalesWalletTokens}`));
  await token
    .connect(companyRestrictionWhitelistWallet)
    .addUnrestrictedReceiver(
      crowdsalesWallet.address,
      await crowdsale.getAddress(),
      ethers.parseEther(`${crowdsalesWalletTokens}`)
    );
  await token.connect(feelessAdminWallet).addFeelessAdmin(await crowdsale.getAddress());

  await token.connect(crowdsalesWallet).approve(await crowdsale.getAddress(), cap);
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
    feelessAdminWallet,
    companyRestrictionWhitelistWallet,
    whitelisterWallet,
    crowdsalesClientPurchaserWallet
  };
};
