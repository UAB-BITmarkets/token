import { ethers } from "hardhat";

import { BITMarketsToken__factory } from "../../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenPublicSale__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenPublicSale__factory";

export const initialRate = 6;
export const finalRate = 5;

export const investorTariff = ethers.parseEther("500.0");
export const investorCap = ethers.parseEther("500000.0");

export const cliff = 1; // milliseconds locked
export const vestingDuration = 1; // milliseconds after cliff for full vesting

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
    feelessAdminWallet,
    companyRestrictionWhitelistWallet,
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

  const BITMarketsTokenPublicSaleFactory = new BITMarketsTokenPublicSale__factory(
    companyLiquidityWallet
  );
  const crowdsale = await BITMarketsTokenPublicSaleFactory.deploy({
    initialRate,
    finalRate,
    wallet: crowdsalesWallet.address,
    purchaser: crowdsalesClientPurchaserWallet.address,
    token: await token.getAddress(),
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

  // await token.approve(crowdsale.getAddress(), cap);
  // await token.addFeeless(companyLiquidityWallet.address);
  // await token.transfer(crowdsale.getAddress(), cap);
  // await token.increaseAllowance(crowdsale.getAddress(), cap);

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
    crowdsalesClientPurchaserWallet
  };
};
