import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  loadContracts,
  openingTime,
  investorTariff,
  investorCap,
  cliff,
  vestingDuration,
  rate
} from "./private/fixture";

describe("BITMarkets ERC20 token whitelisted vesting crowdsale contract tests", () => {
  describe("Participation", () => {
    it("Should not be possible for a non-whitelisted user to participate.", async () => {
      const { crowdsale, addr1 } = await loadFixture(loadContracts);

      await ethers.provider.send("evm_mine", [openingTime]);

      const weiAmount = await crowdsale.getInvestorTariff();

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

    it("Should not be possible for a non-whitelist admin to remove a user.", async () => {
      const { crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      await expect(
        crowdsale.connect(addr2).removeWhitelisted(addr1.address, {
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

      const weiAmount = await crowdsale.getInvestorTariff();

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

      expect(addr2VestedAmountBeforeCliff).to.be.equal(ethers.utils.parseEther("0"));

      // const addr2VestingWallet = await crowdsale.connect(addr2).vestingWallet(addr2.address);
      // const addr2VestingTokens = await token.balanceOf(addr2VestingWallet);

      await ethers.provider.send("evm_mine", [openingTime + cliff + vestingDuration / 2]);

      const companyLiquidityWalletCurrentEthBalance = await crowdsalesWallet.getBalance();
      const companyLiquidityWalletCurrentTokenBalance = await token.balanceOf(
        crowdsalesWallet.address
      );
      // const addr1CurrentEthBalance = await addr1.getBalance();
      const addr2CurrentEthBalance = await addr2.getBalance();

      const addr2TokenBalanceAfterCliffBeforeCompleteVestingNoWithdraw = await token.balanceOf(
        addr2.address
      );

      expect(addr2TokenBalanceAfterCliffBeforeCompleteVestingNoWithdraw).to.be.equal(
        ethers.utils.parseEther("0")
      );

      expect(await crowdsale.connect(addr2).vestedAmount(addr2.address)).to.be.equal(
        ethers.utils.parseEther("450")
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

    it("Should not be possible to participate before sale is open.", async () => {
      const { crowdsale, addr1, whitelisterWallet } = await loadFixture(loadContracts);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);

      await ethers.provider.send("evm_mine", [openingTime - 2]);

      const value = await crowdsale.getInvestorTariff();

      await expect(crowdsale.connect(addr1).buyTokens(addr1.address, { value })).to.be.revertedWith(
        "TimedCrowdsale: not open"
      );
    });

    it("Should enforce tariffs and caps to individual investors", async () => {
      const { token, crowdsale, addr1, addr2, whitelisterWallet } = await loadFixture(
        loadContracts
      );

      expect(await crowdsale.getInvestorTariff()).to.equal(investorTariff);
      expect(await crowdsale.getInvestorCap()).to.equal(investorCap);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);
      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr2.address);

      await ethers.provider.send("evm_mine", [openingTime]);

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, { value: investorTariff.sub(1) })
      ).to.be.revertedWith("Crowdsale: wei < tariff");

      await ethers.provider.send("hardhat_setBalance", [
        addr2.address,
        investorCap.mul(2).toHexString().replace("0x0", "0x")
      ]);

      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap.add(1) })
      ).to.be.revertedWith("Crowdsale: wei > cap");

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap });

      expect(await token.balanceOf(crowdsale.vestingWallet(addr2.address))).to.equal(
        investorCap.mul(rate)
      );
      expect(await crowdsale.getContribution(addr2.address)).to.equal(investorCap);

      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorTariff })
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

      const oneWei = await crowdsale.getInvestorTariff();

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

    it("Should not allow transfers if paused.", async () => {
      const { token, crowdsale, addr1, whitelisterWallet, pauserWallet } = await loadFixture(
        loadContracts
      );

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);

      await token.connect(pauserWallet).pause();

      const oneWei = await crowdsale.getInvestorTariff();

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, { value: oneWei })
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
    });

    it("Should allow a msg.sender to send tokens to contract directly to buy.", async () => {
      const { token, crowdsale, addr1, whitelisterWallet } = await loadFixture(loadContracts);

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(whitelisterWallet).addWhitelisted(addr1.address);

      const oneWei = await crowdsale.getInvestorTariff();

      await addr1.sendTransaction({ to: crowdsale.address, value: oneWei });

      await ethers.provider.send("evm_mine", [openingTime + 3]);

      const vestingWalletAddress = await crowdsale.connect(addr1).vestingWallet(addr1.address);

      const rate = await crowdsale.getCurrentRate();

      expect(await token.balanceOf(vestingWalletAddress)).to.be.equal(oneWei.mul(rate));
    });

    it("Should not allow purchase on behalf of zero address.", async () => {
      const { crowdsale, crowdsalesClientPurchaserWallet, addr1 } = await loadFixture(
        loadContracts
      );

      await ethers.provider.send("evm_mine", [openingTime]);

      const oneWei = await crowdsale.getInvestorTariff();

      await expect(
        crowdsale
          .connect(crowdsalesClientPurchaserWallet)
          .participateOnBehalfOf(ethers.constants.AddressZero, oneWei)
      ).to.be.revertedWith("Crowdsale: beneficiary 0 address");

      await expect(
        crowdsale.connect(crowdsalesClientPurchaserWallet).participateOnBehalfOf(addr1.address, 0)
      ).to.be.revertedWith("Crowdsale: weiAmount is 0");
    });

    it("Should stop when sale cap has been reached.", async () => {
      const {
        token,
        crowdsale,
        crowdsalesWallet,
        crowdsalesClientPurchaserWallet,
        whitelisterWallet
      } = await loadFixture(loadContracts);

      await ethers.provider.send("evm_mine", [openingTime]);

      const investorCapBN = await crowdsale.getInvestorCap();
      const investorCap = Number(ethers.utils.formatEther(investorCapBN));
      const capBN = await token.allowance(crowdsalesWallet.address, crowdsale.address);
      const cap = Number(ethers.utils.formatEther(capBN));
      const rateBN = await crowdsale.getCurrentRate();
      const rate = Number(rateBN);

      const howManyWallets = Math.floor(cap / (investorCap * rate));

      for (let i = 0; i < howManyWallets; i++) {
        const wallet = ethers.Wallet.createRandom();
        await crowdsale.connect(whitelisterWallet).addWhitelisted(wallet.address);
        await crowdsale
          .connect(crowdsalesClientPurchaserWallet)
          .participateOnBehalfOf(wallet.address, investorCapBN);
      }

      const wallet = ethers.Wallet.createRandom();
      await crowdsale.connect(whitelisterWallet).addWhitelisted(wallet.address);
      await expect(
        crowdsale
          .connect(crowdsalesClientPurchaserWallet)
          .participateOnBehalfOf(wallet.address, investorCapBN)
      ).to.be.revertedWith("Allowance too low");
    });

    it("Should not be possible to withdraw if no vesting wallet.", async () => {
      const { crowdsale, addr1 } = await loadFixture(loadContracts);

      await expect(crowdsale.connect(addr1).withdrawTokens(addr1.address)).to.be.revertedWith(
        "No vesting wallet"
      );

      await expect(crowdsale.connect(addr1).vestingWallet(addr1.address)).to.be.revertedWith(
        "No vesting wallet"
      );

      await expect(crowdsale.connect(addr1).vestedAmount(addr1.address)).to.be.revertedWith(
        "No vesting wallet"
      );
    });
  });
});
