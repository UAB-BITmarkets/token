import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  loadContracts,
  rate,
  investorTariff,
  investorCap,
  cliff,
  vestingDuration,
  openingTime,
  closingTime
} from "./fixture";

import type { BITMarketsTokenPrivateSale__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenPrivateSale__factory";

describe("BITMarkets ERC20 token contract deployment tests", () => {
  describe("Main contract deployment", () => {
    it("Should assign a percentage of the total supply of the token to the crowdsale contract and all initial stuff should be ok", async () => {
      const { token, crowdsale, crowdsalesWallet } = await loadFixture(loadContracts);

      const totalSupply = await token.totalSupply();
      const icoSupply = totalSupply.div(5); // 1/5th of total supply
      expect(await crowdsale.token()).to.equal(token.address);
      expect(await crowdsale.tokenWallet()).to.equal(crowdsalesWallet.address);
      expect(await crowdsale.wallet()).to.equal(crowdsalesWallet.address);
      expect(await token.allowance(crowdsalesWallet.address, crowdsale.address)).to.equal(
        icoSupply
      );
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

      const newNewTimestampInSeconds = openingTime + 2.001 * 60 * 1000;
      await ethers.provider.send("evm_mine", [newNewTimestampInSeconds]);
      expect(await crowdsale.isOpen()).to.equal(false);
      expect(await crowdsale.hasClosed()).to.equal(true);
    });

    it("Should revert with wrong Crowdsale args", async () => {
      const {
        token,
        companyLiquidityWallet,
        crowdsalesWallet,
        crowdsalesClientPurchaserWallet,
        whitelisterWallet
      } = await loadFixture(loadContracts);

      const BITMarketsTokenPrivateSaleFactory = (await ethers.getContractFactory(
        "BITMarketsTokenPrivateSale",
        companyLiquidityWallet
      )) as BITMarketsTokenPrivateSale__factory;

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate: 0,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: 0 rate");

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: ethers.constants.AddressZero,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: wallet 0 address");

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: crowdsalesWallet.address,
          purchaser: ethers.constants.AddressZero,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: wallet 0 address");

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: ethers.constants.AddressZero,
          whitelister: whitelisterWallet.address,
          openingTime,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: token 0 address");
    });

    it("Should revert if investor tariff or cap has wrong args", async () => {
      const {
        token,
        companyLiquidityWallet,
        crowdsalesWallet,
        crowdsalesClientPurchaserWallet,
        whitelisterWallet
      } = await loadFixture(loadContracts);

      const BITMarketsTokenPrivateSaleFactory = (await ethers.getContractFactory(
        "BITMarketsTokenPrivateSale",
        companyLiquidityWallet
      )) as BITMarketsTokenPrivateSale__factory;

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime,
          closingTime,
          investorTariff: ethers.utils.parseEther("0"),
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: tariff 0");

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime,
          closingTime,
          investorTariff,
          investorCap: investorTariff.sub(1),
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: cap < tariff");
    });

    it("Should revert if timed crowdsale has wrong args", async () => {
      const {
        token,
        companyLiquidityWallet,
        crowdsalesWallet,
        crowdsalesClientPurchaserWallet,
        whitelisterWallet
      } = await loadFixture(loadContracts);

      const BITMarketsTokenPrivateSaleFactory = (await ethers.getContractFactory(
        "BITMarketsTokenPrivateSale",
        companyLiquidityWallet
      )) as BITMarketsTokenPrivateSale__factory;

      await ethers.provider.send("evm_mine", [openingTime - 10]);

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime: openingTime - 10 * 30 * 24 * 60 * 60,
          closingTime,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: opening early");

      await expect(
        BITMarketsTokenPrivateSaleFactory.deploy({
          rate,
          wallet: crowdsalesWallet.address,
          purchaser: crowdsalesClientPurchaserWallet.address,
          token: token.address,
          whitelister: whitelisterWallet.address,
          openingTime: openingTime + 1,
          closingTime: openingTime - 1,
          investorTariff,
          investorCap,
          cliff,
          vestingDuration
        })
      ).to.revertedWith("Crowdsale: opening < closing");
    });
  });
});
