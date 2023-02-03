import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenWhitelistedVestingCrowdsale__factory } from "../typechain-types/factories/contracts/BITMarketsTokenWhitelistedVestingCrowdsale__factory";

const investorTariff = ethers.utils.parseEther("1.0");
const investorCap = ethers.utils.parseEther("50.0");

const cliff = 1000; // milliseconds locked
const vestingDuration = 2000; // milliseconds after cliff for full vesting

const rate = 10;
const maxWhitelisted = 100000;

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 20;

const companyRate = 1;
const esgFundRate = 1;
const burnRate = 1; // 1/1000 = 0.1%

describe("BITMarkets ERC20 token whitelisted vesting crowdsale contract tests", () => {
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
      minterWallet: minterWallet.address,
      pauserWallet: pauserWallet.address,
      blacklisterWallet: blacklisterWallet.address,
      feelessAdminWallet: feelessAdminWallet.address,
      companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
    });
    await token.deployed();

    const totalSupply = await token.totalSupply();
    const cap = totalSupply.div(5);

    const BITMarketsTokenWhitelistedVestingCrowdsaleFactory = (await ethers.getContractFactory(
      "BITMarketsTokenWhitelistedVestingCrowdsale",
      companyLiquidityWallet
    )) as BITMarketsTokenWhitelistedVestingCrowdsale__factory;
    const crowdsale = await BITMarketsTokenWhitelistedVestingCrowdsaleFactory.deploy({
      rate,
      wallet: crowdsalesWallet.address,
      purchaser: crowdsalesClientPurchaserWallet.address,
      token: token.address,
      whitelister: whitelisterWallet.address,
      cap,
      maxWhitelisted,
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
      minterWallet,
      pauserWallet,
      blacklisterWallet,
      feelessAdminWallet,
      companyRestrictionWhitelistWallet,
      whitelisterWallet,
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

      const newNewTimestampInSeconds = openingTime + 2.001 * 60 * 1000;
      await ethers.provider.send("evm_mine", [newNewTimestampInSeconds]);
      expect(await crowdsale.isOpen()).to.equal(false);
      expect(await crowdsale.hasClosed()).to.equal(true);
    });
  });

  describe("Participation", () => {
    it("Should not be possible for a non-whitelisted user to participate.", async () => {
      const { crowdsale, addr1 } = await loadFixture(loadContracts);

      await ethers.provider.send("evm_mine", [openingTime]);

      const weiAmount = ethers.utils.parseEther("1.0");

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, {
          value: weiAmount,
          from: addr1.address
        })
      ).to.be.revertedWith("Beneficiary not whitelisted");
    });

    it("Should not be possible for a non-whitelist admin to add a user.", async () => {
      const { crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      await expect(
        crowdsale.connect(addr2).addWhitelisted(addr1.address, {
          from: addr2.address
        })
      ).to.be.revertedWith("Caller not whitelist admin");
    });

    it("Should disallow repeated whitelisting.", async () => {
      const { crowdsale, addr1, whitelisterWallet } = await loadFixture(loadContracts);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);

      await expect(
        crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address)
      ).to.be.revertedWith("Account already whitelisted");
    });

    it("Should allow whitelisting.", async () => {
      const { crowdsale, addr1, whitelisterWallet } = await loadFixture(loadContracts);

      expect(await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address)).to.emit(
        "BITMarketsTokenWhitelistedCrowdsale",
        "Account added to whitelist"
      );
    });

    it("Should allow de-whitelisting.", async () => {
      const { crowdsale, addr1, whitelisterWallet } = await loadFixture(loadContracts);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);

      expect(await crowdsale.connect(whitelisterWallet).removeWhitelisted(addr1.address)).to.emit(
        "BITMarketsTokenWhitelistedCrowdsale",
        "Account removed from whitelist"
      );
    });

    it("Should be possible for the whitelist admin to add a participant to the crowdsale", async () => {
      const { token, crowdsale, addr2, crowdsalesWallet, whitelisterWallet } = await loadFixture(
        loadContracts
      );

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr2.address);

      const weiAmount = ethers.utils.parseEther("1.0");

      const companyLiquidityWalletInitialEthBalance = await crowdsalesWallet.getBalance();
      const companyLiquidityWalletInitialTokenBalance = await token.balanceOf(
        crowdsalesWallet.address
      );
      // const addr1InitialEthBalance = await addr1.getBalance();
      const addr2InitialEthBalance = await addr2.getBalance();

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr2).buyTokens(addr2.address, {
        value: weiAmount,
        from: addr2.address
      });

      // const addr1TokenBalance = await token.balanceOf(addr1.address);
      const addr2TokenBalanceWhenLocked = await token.balanceOf(addr2.address);
      const addr2RemainingTokensBeforeCliff = await crowdsale.connect(addr2).remainingTokens();
      const addr2VestedAmountBeforeCliff = await crowdsale
        .connect(addr2)
        .vestedAmount(addr2.address);

      const newTimestampInSeconds = openingTime + cliff + 1;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

      const companyLiquidityWalletCurrentEthBalance = await crowdsalesWallet.getBalance();
      const companyLiquidityWalletCurrentTokenBalance = await token.balanceOf(
        crowdsalesWallet.address
      );
      // const addr1CurrentEthBalance = await addr1.getBalance();
      const addr2CurrentEthBalance = await addr2.getBalance();

      const addr2TokenBalanceAfterCliffBeforeCompleteVestingNoWithdraw = await token.balanceOf(
        addr2.address
      );
      await crowdsale.connect(addr2).withdrawTokens(addr2.address);
      const addr2TokenBalanceAfterCliffBeforeCompleteVesting = await token.balanceOf(addr2.address);

      const newNewTimestampInSeconds = openingTime + cliff + vestingDuration + 10;
      await ethers.provider.send("evm_mine", [newNewTimestampInSeconds]);

      await crowdsale.connect(addr2).withdrawTokens(addr2.address);
      const addr2TokenBalanceAfterCliffCompleteVesting = await token.balanceOf(addr2.address);

      expect(await crowdsale.weiRaised()).to.equal(weiAmount);
      expect(companyLiquidityWalletInitialEthBalance).to.lessThan(
        companyLiquidityWalletCurrentEthBalance
      );
      expect(
        companyLiquidityWalletCurrentEthBalance.sub(companyLiquidityWalletInitialEthBalance)
      ).to.equal(weiAmount);
      expect(addr2CurrentEthBalance).to.lessThan(addr2InitialEthBalance);
      expect(weiAmount).to.lessThan(addr2InitialEthBalance.sub(addr2CurrentEthBalance));
      expect(companyLiquidityWalletCurrentTokenBalance).to.lessThan(
        companyLiquidityWalletInitialTokenBalance
      );
      expect(await crowdsale.remainingTokens()).to.lessThan(
        companyLiquidityWalletCurrentTokenBalance
      );
      expect(addr2TokenBalanceWhenLocked).to.equal(0);
      expect(addr2VestedAmountBeforeCliff).to.lessThan(addr2RemainingTokensBeforeCliff);
      expect(addr2VestedAmountBeforeCliff).to.equal(0);
      expect(addr2TokenBalanceAfterCliffBeforeCompleteVestingNoWithdraw).to.equal(0);
      expect(addr2TokenBalanceWhenLocked).to.lessThan(
        addr2TokenBalanceAfterCliffBeforeCompleteVesting
      );
      expect(addr2TokenBalanceAfterCliffBeforeCompleteVesting).to.lessThan(
        addr2TokenBalanceAfterCliffCompleteVesting
      );
      // expect(companyLiquidityWalletInitialTokenBalance.sub(companyLiquidityWalletCurrentTokenBalance)).to.equal(addr2TokenBalance);
    });

    it("Should enforce tariffs and caps to individual investors", async () => {
      const { token, crowdsale, addr1, addr2, whitelisterWallet } = await loadFixture(
        loadContracts
      );

      expect(await crowdsale.getInvestorTariff()).to.equal(investorTariff);
      expect(await crowdsale.getInvestorCap()).to.equal(investorCap);

      const oneWei = ethers.utils.parseEther("1");

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);
      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr2.address);

      await ethers.provider.send("evm_mine", [openingTime]);

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, { value: investorTariff.sub(1) })
      ).to.be.revertedWith("Crowdsale: wei < tariff");

      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap.add(1) })
      ).to.be.revertedWith("Crowdsale: wei > cap");

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap });
      expect(await token.balanceOf(crowdsale.vestingWallet(addr2.address))).to.equal(
        investorCap.mul(rate)
      );
      expect(await crowdsale.getContribution(addr2.address)).to.equal(investorCap);

      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: oneWei })
      ).to.be.revertedWith("Crowdsale: cap >= hardCap");
    });

    it("Should allow participation on behalf of investors", async () => {
      const {
        token,
        crowdsale,
        companyLiquidityWallet,
        addr1,
        addr2,
        whitelisterWallet,
        crowdsalesClientPurchaserWallet
      } = await loadFixture(loadContracts);

      const oneWei = ethers.utils.parseEther("1");

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);
      await crowdsale
        .connect(crowdsalesClientPurchaserWallet)
        .participateOnBehalfOf(addr1.address, oneWei);
      // await crowdsale.connect(companyLiquidityWallet).buyTokens(addr1.address, { value: oneWei });

      const companyLiquidityWalletCurrentTokenBalance = await token.balanceOf(
        companyLiquidityWallet.address
      );

      const addr1VestingWallet = await crowdsale.vestingWallet(addr1.address);
      const addr1VestingAmount = await token.balanceOf(addr1VestingWallet);

      const rate = await crowdsale.getCurrentRate();

      expect(await crowdsale.remainingTokens()).to.lessThan(
        companyLiquidityWalletCurrentTokenBalance
      );
      expect(0).to.lessThan(addr1VestingAmount);
      expect(addr1VestingAmount).to.be.equal(rate.mul(oneWei));

      await expect(
        crowdsale.connect(companyLiquidityWallet).buyTokens(addr2.address, { value: oneWei })
      ).to.be.revertedWith("Beneficiary not whitelisted");

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr2.address);

      await expect(
        // crowdsale.connect(addr1).buyTokens(addr2.address, { value: oneWei })
        crowdsale.connect(addr1).participateOnBehalfOf(addr2.address, oneWei)
      ).to.be.revertedWith("Only purchaser wallet");
    });
  });
});
