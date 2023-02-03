import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenICOVestingCrowdsale__factory } from "../typechain-types/factories/contracts/BITMarketsTokenICOVestingCrowdsale__factory";

const initialRate = 1000;
const finalRate = 10;

const investorTariff = ethers.utils.parseEther("200.0");
const investorCap = ethers.utils.parseEther("1000.0");

const cliff = 1; // milliseconds locked
const vestingDuration = 1; // milliseconds after cliff for full vesting

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 20;

const companyRate = 1;
const esgFundRate = 1;
const burnRate = 1; // 1/1000 = 0.1%

describe("BITMarkets ERC20 token ICO vesting crowdsale contract tests", () => {
  const openingTime = Date.now() + 60; // Starts in one minute
  const closingTime = openingTime + 2 * 60; // 2 minutes from start

  const loadContracts = async () => {
    const [
      companyLiquidityWallet,
      addr1,
      addr2,
      allocationsWallet,
      crowdsalesWallet,
      companyRewardsWallet,
      esgFundWallet,
      minterWallet,
      pauserWallet,
      blacklisterWallet,
      feelessAdminWallet,
      companyRestrictionWhitelistWallet,
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
      minterWallet: minterWallet.address,
      pauserWallet: pauserWallet.address,
      blacklisterWallet: blacklisterWallet.address,
      feelessAdminWallet: feelessAdminWallet.address,
      companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
    });

    await token.deployed();

    const totalSupply = await token.totalSupply();
    const cap = totalSupply.div(5);

    const BITMarketsTokenICOVestingCrowdsaleFactory = (await ethers.getContractFactory(
      "BITMarketsTokenICOVestingCrowdsale",
      companyLiquidityWallet
    )) as BITMarketsTokenICOVestingCrowdsale__factory;
    const crowdsale = await BITMarketsTokenICOVestingCrowdsaleFactory.deploy({
      initialRate,
      finalRate,
      wallet: crowdsalesWallet.address,
      purchaser: crowdsalesClientPurchaserWallet.address,
      token: token.address,
      cap,
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

    // await token.approve(crowdsale.address, cap);
    // await token.addFeeless(companyLiquidityWallet.address);
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
      minterWallet,
      pauserWallet,
      blacklisterWallet,
      feelessAdminWallet,
      crowdsalesClientPurchaserWallet
    };
  };

  describe("Deployment", () => {
    it("Should assign a percentage of the total supply of the token to the crowdsale contract and all initial stuff should be ok", async () => {
      const { token, crowdsale, crowdsalesWallet } = await loadFixture(loadContracts);

      const totalSupply = await token.totalSupply();
      const icoSupply = totalSupply.div(5); // 1/5th of total supply
      expect(await crowdsale.token()).to.equal(token.address);
      expect(await crowdsale.tokenWallet()).to.equal(crowdsalesWallet.address);
      expect(await crowdsale.wallet()).to.equal(crowdsalesWallet.address);
      expect(await crowdsale.cap()).to.equal(icoSupply);
      expect(await token.allowance(crowdsalesWallet.address, crowdsale.address)).to.equal(
        icoSupply
      );
      expect(await crowdsale.initialRate()).to.equal(initialRate);
      expect(await crowdsale.finalRate()).to.equal(finalRate);
    });

    it("Should have not started yet", async () => {
      const { crowdsale } = await loadFixture(loadContracts);
      expect(await crowdsale.weiRaised()).to.equal(0);
      expect(await crowdsale.capReached()).to.equal(false);
      expect(await crowdsale.isOpen()).to.equal(false);
    });

    it("Should be open for two minute", async () => {
      const { crowdsale } = await loadFixture(loadContracts);
      await ethers.provider.send("evm_mine", [openingTime]);
      expect(await crowdsale.isOpen()).to.equal(true);
      expect(await crowdsale.hasClosed()).to.equal(false);

      const newNewTimestampInSeconds = openingTime + 3 * 60;
      await ethers.provider.send("evm_mine", [newNewTimestampInSeconds]);
      expect(await crowdsale.isOpen()).to.equal(false);
      expect(await crowdsale.hasClosed()).to.equal(true);
      expect(await crowdsale.getCurrentRate()).to.equal(0);
    });

    it("ICO after opening should have a lower rate than the initial", async () => {
      const { crowdsale } = await loadFixture(loadContracts);
      const newTimestampInSeconds = openingTime + 60;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);
      const rate = await crowdsale.getCurrentRate();
      expect(rate).to.lessThanOrEqual(initialRate);
      expect(finalRate).to.lessThanOrEqual(rate);
    });
  });

  describe("Participation", () => {
    it("Should be possible for an address to participate in the crowdsale with the correct rate", async () => {
      const { token, crowdsale, crowdsalesWallet, addr1 } = await loadFixture(loadContracts);

      const weiAmount = ethers.utils.parseEther("200");

      const crowdsalesWalletInitialEthBalance = await crowdsalesWallet.getBalance();
      const crowdsalesWalletInitialTokenBalance = await token.balanceOf(crowdsalesWallet.address);
      const addr1InitialEthBalance = await addr1.getBalance();

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr1).buyTokens(addr1.address, {
        value: weiAmount,
        from: addr1.address
      });

      // const currentRate = await crowdsale.getCurrentRate();
      const addr1TokenBalance = await token.balanceOf(addr1.address);
      const addr1VestingWallet = await crowdsale.vestingWallet(addr1.address);
      const addr1VestingWalletBalance = await token.balanceOf(addr1VestingWallet);

      const newTimestampInSeconds = openingTime + 60;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

      const crowdsalesWalletCurrentEthBalance = await crowdsalesWallet.getBalance();
      const crowdsalesWalletCurrentTokenBalance = await token.balanceOf(crowdsalesWallet.address);
      const addr1CurrentEthBalance = await addr1.getBalance();

      expect(await crowdsale.weiRaised()).to.equal(weiAmount);
      expect(crowdsalesWalletInitialEthBalance).to.lessThan(crowdsalesWalletCurrentEthBalance);
      expect(crowdsalesWalletCurrentEthBalance.sub(crowdsalesWalletInitialEthBalance)).to.equal(
        weiAmount
      );
      expect(addr1CurrentEthBalance).to.lessThan(addr1InitialEthBalance);
      expect(weiAmount).to.lessThan(addr1InitialEthBalance.sub(addr1CurrentEthBalance));
      expect(crowdsalesWalletCurrentTokenBalance).to.lessThan(crowdsalesWalletInitialTokenBalance);
      expect(await crowdsale.remainingTokens()).to.lessThan(crowdsalesWalletCurrentTokenBalance);
      expect(addr1TokenBalance).to.equal(ethers.utils.parseEther("0.0")); // weiAmount.mul(currentRate));
      expect(
        crowdsalesWalletInitialTokenBalance
          .sub(crowdsalesWalletCurrentTokenBalance)
          .eq(addr1VestingWalletBalance)
      ).to.equal(true);
    });

    it("Should reduce the amount of tokens that two users can raise in different times", async () => {
      const {
        // token,
        crowdsale,
        addr1,
        addr2
      } = await loadFixture(loadContracts);

      const weiAmount = ethers.utils.parseEther("200.0");

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr1).buyTokens(addr1.address, { value: weiAmount });

      // const addr1TokenBalance = await token.balanceOf(addr1.address);

      const newTimestampInSeconds = openingTime + 60;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: weiAmount });

      // const newRate = await crowdsale.getCurrentRate();
      // const addr2TokenBalance = await token.balanceOf(addr2.address);

      expect(await crowdsale.weiRaised()).to.equal(weiAmount.mul(2));
      // expect(addr2TokenBalance).to.equal(weiAmount.mul(newRate));
      // expect(addr2TokenBalance).to.lessThanOrEqual(addr1TokenBalance);
    });

    it("Should enforce tariffs and caps to individual investors", async () => {
      const { token, crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      const investorTariff = ethers.utils.parseEther("200.0");
      const underTariff = ethers.utils.parseEther("0.00199");
      expect(await crowdsale.getInvestorTariff()).to.equal(investorTariff);

      const investorCap = ethers.utils.parseEther("1000");
      const overCap = ethers.utils.parseEther("1000.0001");
      expect(await crowdsale.getInvestorCap()).to.equal(investorCap);

      await ethers.provider.send("evm_mine", [openingTime]);

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, { value: underTariff })
      ).to.be.revertedWith("Crowdsale: wei < tariff");
      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: overCap })
      ).to.be.revertedWith("Crowdsale: wei > cap");

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap });
      const currentRate = await crowdsale.getCurrentRate();

      const addr2VestingWallet = await crowdsale.vestingWallet(addr2.address);

      expect(await token.balanceOf(addr2VestingWallet)).to.equal(investorCap.mul(currentRate));
      expect(await crowdsale.getContribution(addr2.address)).to.equal(investorCap);
    });
  });
});
