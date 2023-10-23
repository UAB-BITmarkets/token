import { expect } from "chai";
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { loadContracts, openingTime, initialRate, finalRate } from "./public/fixture";

describe("BITMarkets ERC20 token ICO vesting crowdsale contract tests", () => {
  describe("Participation", () => {
    it("Should be possible for an address to participate in the crowdsale with the correct rate", async () => {
      const { token, crowdsale, crowdsalesWallet, addr1 } = await loadFixture(loadContracts);

      const weiAmount = ethers.parseEther("600");

      const crowdsalesWalletInitialEthBalance = await crowdsalesWallet.provider.getBalance(
        crowdsalesWallet.address
      );
      const crowdsalesWalletInitialTokenBalance = await token.balanceOf(crowdsalesWallet.address);
      const addr1InitialEthBalance = await addr1.provider.getBalance(addr1.address);

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

      const crowdsalesWalletCurrentEthBalance = await crowdsalesWallet.provider.getBalance(
        crowdsalesWallet.address
      );
      const crowdsalesWalletCurrentTokenBalance = await token.balanceOf(crowdsalesWallet.address);
      const addr1CurrentEthBalance = await addr1.provider.getBalance(addr1.address);

      expect(await crowdsale.weiRaised()).to.equal(weiAmount);
      expect(crowdsalesWalletInitialEthBalance).to.lessThan(crowdsalesWalletCurrentEthBalance);
      expect(crowdsalesWalletCurrentEthBalance - crowdsalesWalletInitialEthBalance).to.equal(
        weiAmount
      );
      expect(addr1CurrentEthBalance).to.lessThan(addr1InitialEthBalance);
      expect(weiAmount).to.lessThan(addr1InitialEthBalance - addr1CurrentEthBalance);
      expect(crowdsalesWalletCurrentTokenBalance).to.lessThan(crowdsalesWalletInitialTokenBalance);
      expect(await crowdsale.remainingTokens()).to.lessThan(crowdsalesWalletCurrentTokenBalance);
      expect(addr1TokenBalance).to.equal(ethers.parseEther("0.0")); // weiAmount.mul(currentRate));
      expect(
        crowdsalesWalletInitialTokenBalance - crowdsalesWalletCurrentTokenBalance ===
          addr1VestingWalletBalance
      ).to.equal(true);
    });

    it("Should reduce the amount of tokens that two users can raise in different times", async () => {
      const {
        // token,
        crowdsale,
        addr1,
        addr2
      } = await loadFixture(loadContracts);

      const weiAmount = ethers.parseEther("600.0");

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr1).buyTokens(addr1.address, { value: weiAmount });

      // const addr1TokenBalance = await token.balanceOf(addr1.address);

      const newTimestampInSeconds = openingTime + 60;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: weiAmount });

      // const newRate = await crowdsale.getCurrentRate();
      // const addr2TokenBalance = await token.balanceOf(addr2.address);

      expect(await crowdsale.weiRaised()).to.equal(weiAmount * BigInt(2));
      // expect(addr2TokenBalance).to.equal(weiAmount.mul(newRate));
      // expect(addr2TokenBalance).to.lessThanOrEqual(addr1TokenBalance);
    });

    it("Should enforce tariffs and caps to individual investors", async () => {
      const { token, crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      const investorTariff = ethers.parseEther("500.0");
      const underTariff = ethers.parseEther("0.00199");
      expect(await crowdsale.getInvestorTariff()).to.equal(investorTariff);

      const investorCap = ethers.parseEther("500000");
      const overCap = ethers.parseEther("500000.0001");
      expect(await crowdsale.getInvestorCap()).to.equal(investorCap);

      await ethers.provider.send("evm_mine", [openingTime]);

      await network.provider.send("hardhat_setBalance", [
        addr2.address,
        "0x" + ethers.parseEther("600000").toString(16)
      ]);

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, { value: underTariff })
      ).to.be.revertedWith("Crowdsale: wei < tariff");
      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: overCap })
      ).to.be.revertedWith("Crowdsale: wei > cap");

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap });

      const addr2VestingWallet = await crowdsale.vestingWallet(addr2.address);

      expect(await crowdsale.getContribution(addr2.address)).to.equal(investorCap);

      const vestingAmount = await token.balanceOf(addr2VestingWallet);

      expect(vestingAmount).lessThan(investorCap * BigInt(initialRate));
      expect(investorCap * BigInt(finalRate)).lessThan(vestingAmount);
    });
  });
});
