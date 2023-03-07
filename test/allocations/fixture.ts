import { ethers } from "hardhat";

import type { Wallet } from "ethers";

import type { BITMarketsToken__factory } from "../../typechain-types/factories/contracts/BITMarketsToken__factory";
import type { BITMarketsTokenAllocations__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenAllocations__factory";

export const cliff = 10; // seconds locked
export const vestingDuration = 20; // seconds after cliff for full vesting

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
export const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 20;

const companyRate = 1;
const esgFundRate = 1;
const burnRate = 1; // 1/1000 = 0.1%

const salesWalletsLen = 10;
const salesWallets: Wallet[] = [];
for (let i = 0; i < salesWalletsLen; i++) {
  salesWallets.push(ethers.Wallet.createRandom());
}
// const salesAllocationPerWallet = (allocationsWalletTokens * 40) / 100 / salesWalletsLen;
//
// const marketingWallet = ethers.Wallet.createRandom();
// const marketingAllocation = (allocationsWalletTokens * 25) / 100;

const teamWalletsLen = 3;
const teamWallets: Wallet[] = [];
for (let i = 0; i < teamWalletsLen; i++) {
  teamWallets.push(ethers.Wallet.createRandom());
}
// const teamAllocationPerWallet = (allocationsWalletTokens * 30) / 100 / teamWalletsLen;

const airdropsWalletsLen = 10;
const airdropsWallets: Wallet[] = [];
for (let i = 0; i < airdropsWalletsLen; i++) {
  airdropsWallets.push(ethers.Wallet.createRandom());
}
// const airdropsAllocationPerWallet = (allocationsWalletTokens * 5) / 100 / airdropsWalletsLen;

export const loadContracts = async () => {
  const [
    companyLiquidityWallet, // needed
    addr1,
    addr2,
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
  const cap = totalSupply.div(3);

  const BITMarketsTokenAllocationsFactory = (await ethers.getContractFactory(
    "BITMarketsTokenAllocations",
    companyLiquidityWallet
  )) as BITMarketsTokenAllocations__factory;
  const allocations = await BITMarketsTokenAllocationsFactory.deploy(
    allocationsWallet.address,
    allocationsAdminWallet.address,
    token.address,
    cliff,
    vestingDuration
  );
  await allocations.deployed();

  await token.connect(feelessAdminWallet).addFeeless(allocations.address);
  await token.connect(feelessAdminWallet).addFeeless(allocationsWallet.address);
  await token
    .connect(companyRestrictionWhitelistWallet)
    .addUnrestrictedReceiver(
      companyLiquidityWallet.address,
      allocationsWallet.address,
      ethers.utils.parseEther(`${allocationsWalletTokens}`)
    );
  await token.transfer(
    allocationsWallet.address,
    ethers.utils.parseEther(`${allocationsWalletTokens}`)
  );
  await token
    .connect(companyRestrictionWhitelistWallet)
    .addUnrestrictedReceiver(
      allocationsWallet.address,
      allocations.address,
      ethers.utils.parseEther(`${allocationsWalletTokens}`)
    );
  await token.connect(feelessAdminWallet).addFeelessAdmin(allocations.address);

  await token.connect(allocationsWallet).approve(allocations.address, cap);
  // await token.transfer(crowdsale.address, cap);
  // await token.increaseAllowance(crowdsale.address, cap);

  return {
    token,
    allocations,
    companyLiquidityWallet,
    addr1,
    addr2,
    allocationsWallet,
    crowdsalesWallet,
    companyRewardsWallet,
    esgFundWallet,
    pauserWallet,
    whitelisterWallet,
    feelessAdminWallet,
    companyRestrictionWhitelistWallet,
    allocationsAdminWallet,
    crowdsalesClientPurchaserWallet
  };
};
