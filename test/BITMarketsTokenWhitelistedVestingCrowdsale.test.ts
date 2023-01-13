import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenWhitelistedVestingCrowdsale__factory } from "../typechain-types/factories/contracts/BITMarketsTokenWhitelistedVestingCrowdsale__factory";

const initialSupply = 300000000;
// const finalSupply = 200000000;
// const burnRate = 1; // 1/1000 = 0.1%
const companyRate = 1;
const fundRate = 1;

const investorTariff = ethers.utils.parseEther("1.0");
const investorCap = ethers.utils.parseEther("50.0");

const cliff = 1000; // milliseconds locked
const vestingDuration = 2000; // milliseconds after cliff for full vesting

const companyRewardsWallet = ethers.Wallet.createRandom();

const rate = 10;
const maxWhitelisted = 100000;

describe("BITMarkets ERC20 token whitelisted vesting crowdsale contract tests", () => {
  const openingTime = Date.now() + 60 * 1000; // Starts in one minute
  const closingTime = openingTime + 2 * 60 * 1000; // 2 minutes from start

  const loadContracts = async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const BITMarketsTokenFactory = (await ethers.getContractFactory(
      "BITMarketsToken",
      owner
    )) as BITMarketsToken__factory;

    const token = await BITMarketsTokenFactory.deploy(
      initialSupply,
      // finalSupply,
      // burnRate,
      companyRate,
      companyRewardsWallet.address,
      fundRate,
      addr1.address, // esg fund address
      addr2.address // pauser address
    );
    await token.deployed();

    const totalSupply = await token.totalSupply();
    const cap = totalSupply.div(5);

    const BITMarketsTokenWhitelistedVestingCrowdsaleFactory = (await ethers.getContractFactory(
      "BITMarketsTokenWhitelistedVestingCrowdsale",
      owner
    )) as BITMarketsTokenWhitelistedVestingCrowdsale__factory;
    const crowdsale = await BITMarketsTokenWhitelistedVestingCrowdsaleFactory.deploy({
      rate,
      wallet: owner.address,
      token: token.address,
      whitelister: addr1.address,
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

    await token.approve(crowdsale.address, cap);
    await token.addFeeless(crowdsale.address);
    // await token.transfer(crowdsale.address, cap);
    // await token.increaseAllowance(crowdsale.address, cap);

    return { token, crowdsale, owner, addr1, addr2 };
  };

  describe("Deployment", () => {
    it("Should assign a percentage of the total supply of the token to the crowdsale contract and all initial stuff should be ok", async () => {
      const { token, crowdsale, owner } = await loadFixture(loadContracts);

      const totalSupply = await token.totalSupply();
      const icoSupply = totalSupply.div(5); // 1/5th of total supply
      expect(await crowdsale.token()).to.equal(token.address);
      expect(await crowdsale.tokenWallet()).to.equal(owner.address);
      expect(await crowdsale.wallet()).to.equal(owner.address);
      expect(await crowdsale.cap()).to.equal(icoSupply);
      expect(await token.allowance(owner.address, crowdsale.address)).to.equal(icoSupply);
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
      const { crowdsale, addr1 } = await loadFixture(loadContracts);

      await crowdsale.connect(addr1).addWhitelisted(addr1.address);

      await expect(crowdsale.connect(addr1).addWhitelisted(addr1.address)).to.be.revertedWith(
        "Account already whitelisted"
      );
    });

    it("Should allow whitelisting.", async () => {
      const { crowdsale, addr1 } = await loadFixture(loadContracts);

      expect(await crowdsale.connect(addr1).addWhitelisted(addr1.address)).to.emit(
        "BITMarketsTokenWhitelistedCrowdsale",
        "Account added to whitelist"
      );
    });

    it("Should allow de-whitelisting.", async () => {
      const { crowdsale, addr1 } = await loadFixture(loadContracts);

      await crowdsale.connect(addr1).addWhitelisted(addr1.address);

      expect(await crowdsale.connect(addr1).removeWhitelisted(addr1.address)).to.emit(
        "BITMarketsTokenWhitelistedCrowdsale",
        "Account removed from whitelist"
      );
    });

    it("Should be possible for the whitelist admin to add a participant to the crowdsale", async () => {
      const { token, crowdsale, owner, addr1, addr2 } = await loadFixture(loadContracts);

      await crowdsale.connect(addr1).addWhitelisted(addr2.address);

      const weiAmount = ethers.utils.parseEther("1.0");

      const ownerInitialEthBalance = await owner.getBalance();
      const ownerInitialTokenBalance = await token.balanceOf(owner.address);
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

      const ownerCurrentEthBalance = await owner.getBalance();
      const ownerCurrentTokenBalance = await token.balanceOf(owner.address);
      // const addr1CurrentEthBalance = await addr1.getBalance();
      const addr2CurrentEthBalance = await addr2.getBalance();

      const addr2TokenBalanceAfterCliffBeforeCompleteVestingNoWithdraw = await token.balanceOf(
        addr2.address
      );
      await crowdsale.connect(addr2).withdrawTokens();
      const addr2TokenBalanceAfterCliffBeforeCompleteVesting = await token.balanceOf(addr2.address);

      const newNewTimestampInSeconds = openingTime + cliff + vestingDuration;
      await ethers.provider.send("evm_mine", [newNewTimestampInSeconds]);

      await crowdsale.connect(addr2).withdrawTokens();
      const addr2TokenBalanceAfterCliffCompleteVesting = await token.balanceOf(addr2.address);

      expect(await crowdsale.weiRaised()).to.equal(weiAmount);
      expect(ownerInitialEthBalance).to.lessThan(ownerCurrentEthBalance);
      expect(ownerCurrentEthBalance.sub(ownerInitialEthBalance)).to.equal(weiAmount);
      expect(addr2CurrentEthBalance).to.lessThan(addr2InitialEthBalance);
      expect(weiAmount).to.lessThan(addr2InitialEthBalance.sub(addr2CurrentEthBalance));
      expect(ownerCurrentTokenBalance).to.lessThan(ownerInitialTokenBalance);
      expect(await crowdsale.remainingTokens()).to.lessThan(ownerCurrentTokenBalance);
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
      // expect(ownerInitialTokenBalance.sub(ownerCurrentTokenBalance)).to.equal(addr2TokenBalance);
    });

    it("Should enforce tariffs and caps to individual investors", async () => {
      const { token, crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      expect(await crowdsale.getInvestorTariff()).to.equal(investorTariff);
      expect(await crowdsale.getInvestorCap()).to.equal(investorCap);

      const oneWei = ethers.utils.parseEther("1");

      await crowdsale.connect(addr1).addWhitelisted(addr1.address);
      await crowdsale.connect(addr1).addWhitelisted(addr2.address);

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
      const { token, crowdsale, owner, addr1, addr2 } = await loadFixture(loadContracts);

      const oneWei = ethers.utils.parseEther("1");

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr1).addWhitelisted(addr1.address);
      // await crowdsale.participateOnBehalfOf(addr1.address, oneWei);
      await crowdsale.connect(owner).buyTokens(addr1.address, { value: oneWei });

      const ownerCurrentTokenBalance = await token.balanceOf(owner.address);

      const addr1VestingWallet = await crowdsale.vestingWallet(addr1.address);
      const addr1VestingAmount = await token.balanceOf(addr1VestingWallet);

      const rate = await crowdsale.getCurrentRate();

      expect(await crowdsale.remainingTokens()).to.lessThan(ownerCurrentTokenBalance);
      expect(0).to.lessThan(addr1VestingAmount);
      expect(addr1VestingAmount).to.be.equal(rate.mul(oneWei));

      await expect(
        crowdsale.connect(owner).buyTokens(addr2.address, { value: oneWei })
      ).to.be.revertedWith("Beneficiary not whitelisted");

      await crowdsale.connect(addr1).addWhitelisted(addr2.address);

      await expect(
        crowdsale.connect(addr1).buyTokens(addr2.address, { value: oneWei })
      ).to.be.revertedWith("Only company wallet");
    });
  });
});
