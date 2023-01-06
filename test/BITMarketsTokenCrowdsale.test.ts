import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenCrowdsale__factory } from "../typechain-types/factories/contracts/BITMarketsTokenCrowdsale__factory";

const initialSupply = 300000000;
// const finalSupply = 200000000;
// const burnRate = 1; // 1/1000 = 0.1%
const companyRate = 1; // over 1000
const fundRate = 1;

const companyRewardsWallet = ethers.Wallet.createRandom();

const initialRate = 1000;
const finalRate = 10;

describe("BITMarkets ERC20 token ICO crowdsale contract tests", () => {
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
      addr1.address,
      addr2.address
    );
    await token.deployed();

    const totalSupply = await token.totalSupply();
    const cap = totalSupply.div(5);

    const BITMarketsTokenCrowdsaleFactory = (await ethers.getContractFactory(
      "BITMarketsTokenCrowdsale",
      owner
    )) as BITMarketsTokenCrowdsale__factory;
    const crowdsale = await BITMarketsTokenCrowdsaleFactory.deploy(
      initialRate,
      owner.address,
      token.address,
      cap,
      openingTime,
      closingTime,
      finalRate
    );
    await crowdsale.deployed();

    await token.approve(crowdsale.address, cap);
    // await token.addFeeless(owner.address);
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

      const newNewTimestampInSeconds = openingTime + 2.001 * 60 * 1000;
      await ethers.provider.send("evm_mine", [newNewTimestampInSeconds]);
      expect(await crowdsale.isOpen()).to.equal(false);
      expect(await crowdsale.hasClosed()).to.equal(true);
      expect(await crowdsale.getCurrentRate()).to.equal(0);
    });

    it("ICO after opening should have a lower rate than the initial", async () => {
      const { crowdsale } = await loadFixture(loadContracts);
      const newTimestampInSeconds = openingTime + 60 * 1000;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);
      const rate = await crowdsale.getCurrentRate();
      expect(rate).to.lessThanOrEqual(initialRate);
      expect(finalRate).to.lessThanOrEqual(rate);
    });
  });

  describe("Participation", () => {
    it("Should be possible for an address to participate in the crowdsale with the correct rate", async () => {
      const { token, crowdsale, owner, addr1 } = await loadFixture(loadContracts);

      const weiAmount = ethers.utils.parseEther("0.2");

      const ownerInitialEthBalance = await owner.getBalance();
      const ownerInitialTokenBalance = await token.balanceOf(owner.address);
      const addr1InitialEthBalance = await addr1.getBalance();

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr1).buyTokens(addr1.address, {
        value: weiAmount,
        from: addr1.address
      });

      const currentRate = await crowdsale.getCurrentRate();
      const addr1TokenBalance = await token.balanceOf(addr1.address);

      const newTimestampInSeconds = openingTime + 60 * 1000;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

      const ownerCurrentEthBalance = await owner.getBalance();
      const ownerCurrentTokenBalance = await token.balanceOf(owner.address);
      const addr1CurrentEthBalance = await addr1.getBalance();

      expect(await crowdsale.weiRaised()).to.equal(weiAmount);
      expect(ownerInitialEthBalance).to.lessThan(ownerCurrentEthBalance);
      expect(ownerCurrentEthBalance.sub(ownerInitialEthBalance)).to.equal(weiAmount);
      expect(addr1CurrentEthBalance).to.lessThan(addr1InitialEthBalance);
      expect(weiAmount).to.lessThan(addr1InitialEthBalance.sub(addr1CurrentEthBalance));
      expect(ownerCurrentTokenBalance).to.lessThan(ownerInitialTokenBalance);
      expect(await crowdsale.remainingTokens()).to.lessThan(ownerCurrentTokenBalance);
      expect(addr1TokenBalance).to.equal(weiAmount.mul(currentRate));
      expect(ownerInitialTokenBalance.sub(ownerCurrentTokenBalance)).to.equal(addr1TokenBalance);
    });

    it("Should reduce the amount of tokens that two users can raise in different times", async () => {
      const { token, crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      const weiAmount = ethers.utils.parseEther("1.0");

      await ethers.provider.send("evm_mine", [openingTime]);

      await crowdsale.connect(addr1).buyTokens(addr1.address, { value: weiAmount });

      const addr1TokenBalance = await token.balanceOf(addr1.address);

      const newTimestampInSeconds = openingTime + 60 * 1000;
      await ethers.provider.send("evm_mine", [newTimestampInSeconds]);

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: weiAmount });

      const newRate = await crowdsale.getCurrentRate();
      const addr2TokenBalance = await token.balanceOf(addr2.address);

      expect(await crowdsale.weiRaised()).to.equal(weiAmount.mul(2));
      expect(addr2TokenBalance).to.equal(weiAmount.mul(newRate));
      expect(addr2TokenBalance).to.lessThanOrEqual(addr1TokenBalance);
    });

    it("Should enforce tariffs and caps to individual investors", async () => {
      const { token, crowdsale, addr1, addr2 } = await loadFixture(loadContracts);

      const investorTariff = ethers.utils.parseEther("0.002");
      const underTariff = ethers.utils.parseEther("0.00199");
      expect(await crowdsale.getInvestorTariff()).to.equal(investorTariff);

      const investorCap = ethers.utils.parseEther("50");
      const overCap = ethers.utils.parseEther("50.0001");
      expect(await crowdsale.getInvestorCap()).to.equal(investorCap);

      const oneWei = ethers.utils.parseEther("1");

      await ethers.provider.send("evm_mine", [openingTime]);

      await expect(
        crowdsale.connect(addr1).buyTokens(addr1.address, { value: underTariff })
      ).to.be.revertedWith("Crowdsale: wei < tariff");
      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: overCap })
      ).to.be.revertedWith("Crowdsale: wei > cap");

      await crowdsale.connect(addr2).buyTokens(addr2.address, { value: investorCap });
      const currentRate = await crowdsale.getCurrentRate();
      expect(await token.balanceOf(addr2.address)).to.equal(investorCap.mul(currentRate));
      expect(await crowdsale.getContribution(addr2.address)).to.equal(investorCap);

      await expect(
        crowdsale.connect(addr2).buyTokens(addr2.address, { value: oneWei })
      ).to.be.revertedWith("Crowdsale: cap >= hardCap");
    });
  });
});
