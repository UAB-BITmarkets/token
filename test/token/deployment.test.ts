import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { loadContract } from "./fixture";

import type { BITMarketsToken__factory } from "../../typechain-types/factories/contracts/BITMarketsToken__factory";

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 10;

const companyRate = 1;
const esgFundRate = 1;
const burnRate = 1; // 1/1000 = 0.1%

describe("BITMarkets ERC20 token contract deployment tests", () => {
  describe("Main contract deployment", () => {
    it("Should assign one third of the total supply of tokens to the companyLiquidityWallet", async () => {
      const { token, companyLiquidityWallet } = await loadFixture(loadContract);
      const companyLiquidityBalance = await token.balanceOf(companyLiquidityWallet.address);
      expect(await token.totalSupply()).to.equal(companyLiquidityBalance);
    });

    it("Should assign one third of the total supply of tokens to the allocations wallet.", async () => {
      const { token, companyLiquidityWallet, allocationsWallet } = await loadFixture(loadContract);
      const balance = await token.allowance(
        companyLiquidityWallet.address,
        allocationsWallet.address
      );
      expect(await token.totalSupply()).to.equal(balance.mul(3));
    });

    it("Should assign one third of the total supply of tokens to the crowdsales wallet.", async () => {
      const { token, companyLiquidityWallet, crowdsalesWallet } = await loadFixture(loadContract);
      const balance = await token.allowance(
        companyLiquidityWallet.address,
        crowdsalesWallet.address
      );
      expect(await token.totalSupply()).to.equal(balance.mul(3));
    });

    it("Should not be possible to deploy with invalid initial funds", async () => {
      const {
        companyLiquidityWallet,
        allocationsWallet,
        crowdsalesWallet,
        companyRewardsWallet,
        esgFundWallet,
        minterWallet,
        pauserWallet,
        blacklisterWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet
      } = await loadFixture(loadContract);

      const BITMarketsTokenFactory = (await ethers.getContractFactory(
        "BITMarketsToken",
        companyLiquidityWallet
      )) as BITMarketsToken__factory;

      await expect(
        BITMarketsTokenFactory.deploy({
          initialSupply,
          finalSupply,
          allocationsWalletTokens: 2 * allocationsWalletTokens + 1,
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
        })
      ).to.revertedWith("Invalid initial funds");
    });

    it("Should not be possible to deploy with larger final supply than initial", async () => {
      const {
        companyLiquidityWallet,
        allocationsWallet,
        crowdsalesWallet,
        companyRewardsWallet,
        esgFundWallet,
        minterWallet,
        pauserWallet,
        blacklisterWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet
      } = await loadFixture(loadContract);

      const BITMarketsTokenFactory = (await ethers.getContractFactory(
        "BITMarketsToken",
        companyLiquidityWallet
      )) as BITMarketsToken__factory;

      await expect(
        BITMarketsTokenFactory.deploy({
          initialSupply,
          finalSupply: initialSupply + 1,
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
        })
      ).to.revertedWith("Invalid final supply");
    });

    it("Should not be possible to deploy with 0 final supply", async () => {
      const {
        companyLiquidityWallet,
        allocationsWallet,
        crowdsalesWallet,
        companyRewardsWallet,
        esgFundWallet,
        minterWallet,
        pauserWallet,
        blacklisterWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet
      } = await loadFixture(loadContract);

      const BITMarketsTokenFactory = (await ethers.getContractFactory(
        "BITMarketsToken",
        companyLiquidityWallet
      )) as BITMarketsToken__factory;

      await expect(
        BITMarketsTokenFactory.deploy({
          initialSupply,
          finalSupply: 0,
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
        })
      ).to.revertedWith("Less than zero final supply");
    });
  });

  describe("Abstract contracts deployment", () => {
    it("Should not be possible to deploy with wrong fees params", async () => {
      const {
        companyLiquidityWallet,
        allocationsWallet,
        crowdsalesWallet,
        companyRewardsWallet,
        esgFundWallet,
        minterWallet,
        pauserWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet
      } = await loadFixture(loadContract);

      const BITMarketsTokenFactory = (await ethers.getContractFactory(
        "BITMarketsToken",
        companyLiquidityWallet
      )) as BITMarketsToken__factory;

      await expect(
        BITMarketsTokenFactory.deploy({
          initialSupply,
          finalSupply,
          allocationsWalletTokens,
          crowdsalesWalletTokens,
          maxCompanyWalletTransfer,
          companyRate: 2000,
          esgFundRate,
          burnRate,
          allocationsWallet: allocationsWallet.address,
          crowdsalesWallet: crowdsalesWallet.address,
          companyRewardsWallet: companyRewardsWallet.address,
          esgFundWallet: esgFundWallet.address,
          minterWallet: minterWallet.address,
          pauserWallet: pauserWallet.address,
          blacklisterWallet: ethers.constants.AddressZero,
          feelessAdminWallet: feelessAdminWallet.address,
          companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
        })
      ).to.revertedWith("Company rate out of bounds");

      await expect(
        BITMarketsTokenFactory.deploy({
          initialSupply,
          finalSupply,
          allocationsWalletTokens,
          crowdsalesWalletTokens,
          maxCompanyWalletTransfer,
          companyRate,
          esgFundRate: 2000,
          burnRate,
          allocationsWallet: allocationsWallet.address,
          crowdsalesWallet: crowdsalesWallet.address,
          companyRewardsWallet: companyRewardsWallet.address,
          esgFundWallet: esgFundWallet.address,
          minterWallet: minterWallet.address,
          pauserWallet: pauserWallet.address,
          blacklisterWallet: ethers.constants.AddressZero,
          feelessAdminWallet: feelessAdminWallet.address,
          companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
        })
      ).to.revertedWith("ESG Fund rate out of bounds");

      await expect(
        BITMarketsTokenFactory.deploy({
          initialSupply,
          finalSupply,
          allocationsWalletTokens,
          crowdsalesWalletTokens,
          maxCompanyWalletTransfer,
          companyRate,
          esgFundRate,
          burnRate: 2000,
          allocationsWallet: allocationsWallet.address,
          crowdsalesWallet: crowdsalesWallet.address,
          companyRewardsWallet: companyRewardsWallet.address,
          esgFundWallet: esgFundWallet.address,
          minterWallet: minterWallet.address,
          pauserWallet: pauserWallet.address,
          blacklisterWallet: ethers.constants.AddressZero,
          feelessAdminWallet: feelessAdminWallet.address,
          companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
        })
      ).to.revertedWith("Burn rate out of bounds");

      await expect(
        BITMarketsTokenFactory.deploy({
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
          companyRewardsWallet: ethers.constants.AddressZero,
          esgFundWallet: esgFundWallet.address,
          minterWallet: minterWallet.address,
          pauserWallet: pauserWallet.address,
          blacklisterWallet: ethers.constants.AddressZero,
          feelessAdminWallet: feelessAdminWallet.address,
          companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
        })
      ).to.revertedWith("Invalid rewards wallet");

      await expect(
        BITMarketsTokenFactory.deploy({
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
          esgFundWallet: ethers.constants.AddressZero,
          minterWallet: minterWallet.address,
          pauserWallet: pauserWallet.address,
          blacklisterWallet: ethers.constants.AddressZero,
          feelessAdminWallet: feelessAdminWallet.address,
          companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
        })
      ).to.revertedWith("Invalid esg fund wallet");

      await expect(
        BITMarketsTokenFactory.deploy({
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
          blacklisterWallet: ethers.constants.AddressZero,
          feelessAdminWallet: ethers.constants.AddressZero,
          companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
        })
      ).to.revertedWith("Invalid admin wallet");
    });
  });
});
