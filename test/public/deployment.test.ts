import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  loadContracts,
  initialRate,
  finalRate,
  investorTariff,
  investorCap,
  cliff,
  vestingDuration,
  openingTime,
  closingTime
} from "./fixture";

import { BITMarketsTokenPublicSale__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenPublicSale__factory";

describe("BITMarkets ERC20 token contract deployment tests", () => {
  describe("Main contract deployment", () => {
    it("Should assign a percentage of the total supply of the token to the crowdsale contract and all initial stuff should be ok", async () => {
      const { token, crowdsale, crowdsalesWallet } = await loadFixture(loadContracts);

      const totalSupply = await token.totalSupply();
      const icoSupply = totalSupply / BigInt(5); // 1/5th of total supply
      expect(await crowdsale.token()).to.equal(await token.getAddress());
      expect(await crowdsale.tokenWallet()).to.equal(crowdsalesWallet.address);
      expect(await crowdsale.wallet()).to.equal(crowdsalesWallet.address);
      expect(await token.allowance(crowdsalesWallet.address, crowdsale.getAddress())).to.equal(
        icoSupply
      );
      expect(await crowdsale.initialRate()).to.equal(initialRate);
      expect(await crowdsale.finalRate()).to.equal(finalRate);
    });

    it("Should have not started yet", async () => {
      const { crowdsale } = await loadFixture(loadContracts);
      expect(await crowdsale.weiRaised()).to.equal(0);
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

    it("Should revert if increasing price crowdsale has wrong args", async () => {
      const { token, companyLiquidityWallet, crowdsalesWallet, crowdsalesClientPurchaserWallet } =
        await loadFixture(loadContracts);

      const BITMarketsTokenPublicSaleFactory = new BITMarketsTokenPublicSale__factory(
        companyLiquidityWallet
      );
      await expect(
        BITMarketsTokenPublicSaleFactory.deploy({
          initialRate,
          finalRate: 0,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.getAddress(),
          openingTime,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: final rate 0");

      await expect(
        BITMarketsTokenPublicSaleFactory.deploy({
          initialRate,
          finalRate: initialRate + 1,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.getAddress(),
          openingTime,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: initial > final rate");
    });
  });
});
