import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { loadContract } from "./token/fixture";
import { allocationsWallet } from "../utils/testAccounts";

const initialSupply = 300000000;

const companyWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 10;

const someRandomWallet = ethers.Wallet.createRandom();

describe("BITMarkets ERC20 token contract tests", () => {
  describe("Transactions", () => {
    it("Should transfer tokens between accounts", async () => {
      const { token, companyLiquidityWallet, addr1, addr2 } = await loadFixture(loadContract);

      // Transfer 50 tokens from companyLiquidityWallet to addr1
      const addr1TransferredAmount = ethers.utils.parseEther("50");

      // const totalSupplyBefore = await token.totalSupply();
      // const companyLiquidityWalletBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);
      const addr1BalanceBefore = await token.balanceOf(addr1.address);
      await token.connect(companyLiquidityWallet).transfer(addr1.address, addr1TransferredAmount);

      // const totalSupplyAfter = await token.totalSupply();
      // const companyLiquidityWalletBalanceAfter = await token.balanceOf(companyLiquidityWallet.address);
      const addr1BalanceAfter = await token.balanceOf(addr1.address);

      // expect(totalSupplyAfter).to.be.lessThan(totalSupplyBefore);
      // expect(companyLiquidityWalletBalanceBefore).to.be.lessThan(companyLiquidityWalletBalanceAfter);
      expect(addr1BalanceBefore).to.be.lessThan(addr1BalanceAfter);
      // expect(addr1BalanceAfter.lt(addr1TransferredAmount)).to.be.equal(true);

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      const addr2TransferredAmount = ethers.utils.parseEther("49");
      await token.connect(addr1).transfer(addr2.address, addr2TransferredAmount);
      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance.eq(addr2TransferredAmount)).to.equal(true);
    });

    it("Should fail if sender doesn’t have enough tokens", async () => {
      const { token, companyLiquidityWallet, addr1 } = await loadFixture(loadContract);

      // Try to send 1 token from addr1 (0 tokens) to companyLiquidityWallet (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(
        token.connect(addr1).transfer(companyLiquidityWallet.address, 1, { from: addr1.address })
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // const superHighAmount = ethers.utils.parseEther(`${companyWalletTokens + 1}`);
      // await expect(token.transfer(addr1.address, superHighAmount)).to.be.revertedWith(
      //   "ERC20: transfer amount exceeds balance"
      // );
    });

    it("Should add transaction fees to the esg fund and the company rewards and induce burning with each transfer", async () => {
      const { token, companyLiquidityWallet, addr2, esgFundWallet, companyRewardsWallet } =
        await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const totalSupplyBefore = await token.totalSupply();
      const esgFundBalanceBefore = await token.balanceOf(esgFundWallet.address);
      const companyRewardsBalanceBefore = await token.balanceOf(companyRewardsWallet.address);

      await companyLiquidityWallet.sendTransaction({
        to: someRandomWallet.address,
        value: ethers.utils.parseEther("1.0")
      });

      // Transfer 100 tokens from companyLiquidityWallet to addr2. Does not induce fees because companyLiquidityWallet is feeless.
      await token.transfer(addr2.address, ethers.utils.parseEther("1.0"));

      const nextTime = startTime + 10; // 10s
      await ethers.provider.send("evm_mine", [nextTime]);

      // Transfer 40 tokens from addr2 to someRandomWallet. Should induce fees.
      await token.connect(addr2).transfer(someRandomWallet.address, ethers.utils.parseEther("0.4"));

      const totalSupplyAfter = await token.totalSupply();

      const companyRewardsBalanceAfter = await token.balanceOf(companyRewardsWallet.address);
      expect(companyRewardsBalanceBefore).to.be.lessThan(companyRewardsBalanceAfter);

      const esgFundBalanceAfter = await token.balanceOf(esgFundWallet.address);
      expect(esgFundBalanceBefore).to.be.lessThan(esgFundBalanceAfter);

      expect(totalSupplyAfter).to.be.lessThan(totalSupplyBefore);
    });

    it("Should be possible to do feeless transfers", async () => {
      const {
        token,
        companyLiquidityWallet,
        addr1,
        addr2,
        feelessAdminWallet,
        companyRewardsWallet
      } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      expect(await token.connect(feelessAdminWallet).addFeeless(someRandomWallet.address)).to.emit(
        "BITMarketsToken",
        "Caller added to feeless"
      );

      expect(await token.isFeeless(someRandomWallet.address)).to.be.equal(true);

      await expect(token.connect(addr1).addFeeless(addr2.address)).to.revertedWith(
        "Caller not in feeless admins"
      );

      await expect(
        token.connect(feelessAdminWallet).addFeeless(ethers.constants.AddressZero)
      ).to.revertedWith("Account is zero");

      await expect(
        token.connect(feelessAdminWallet).addFeeless(someRandomWallet.address)
      ).to.revertedWith("Account already feeless");

      await token.connect(feelessAdminWallet).addFeeless(addr2.address);

      const someOtherRandomWallet = ethers.Wallet.createRandom();
      token.connect(feelessAdminWallet).addFeeless(someOtherRandomWallet.address);

      expect(
        await token.connect(feelessAdminWallet).removeFeeless(someRandomWallet.address)
      ).to.emit("BITMarketsToken", "Caller removed from feeless");

      await expect(
        token.connect(feelessAdminWallet).removeFeeless(ethers.constants.AddressZero)
      ).to.revertedWith("Account is zero");

      const randomWallet = ethers.Wallet.createRandom();

      await token.connect(feelessAdminWallet).addFeeless(randomWallet.address);

      await token.transfer(addr2.address, ethers.utils.parseEther("1.0"), {
        from: companyLiquidityWallet.address
      });

      const nextTime = startTime + 12; // 10s
      await ethers.provider.send("evm_mine", [nextTime]);

      const esgFundBalanceBefore = await token.balanceOf(addr1.address);
      const companyRewardsBalanceBefore = await token.balanceOf(companyRewardsWallet.address);
      const companyWalletBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);
      const randomWalletBalanceBefore = await token.balanceOf(randomWallet.address);

      await token
        .connect(addr2)
        .transfer(randomWallet.address, ethers.utils.parseEther("0.2"), { from: addr2.address });

      const nextNextTime = startTime + 20; // 20s
      await ethers.provider.send("evm_mine", [nextNextTime]);

      const esgFundBalanceAfter = await token.balanceOf(addr1.address);
      expect(esgFundBalanceBefore).to.equal(esgFundBalanceAfter);

      const companyRewardsBalanceAfter = await token.balanceOf(companyRewardsWallet.address);
      expect(companyRewardsBalanceBefore).to.equal(companyRewardsBalanceAfter);

      const companyWalletBalanceAfter = await token.balanceOf(companyLiquidityWallet.address);
      expect(companyWalletBalanceAfter).to.equal(companyWalletBalanceBefore);

      const randomWalletBalanceAfter = await token.balanceOf(randomWallet.address);
      expect(randomWalletBalanceBefore).to.be.lessThan(randomWalletBalanceAfter);
    });
  });

  describe("Minting and burning", () => {
    it("Should be possible to burn", async () => {
      const { token, companyLiquidityWallet } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const totalSupplyBefore = await token.totalSupply();

      await token.connect(companyLiquidityWallet).burn(ethers.utils.parseEther("1"));

      const totalSupplyAfter = await token.totalSupply();

      expect(totalSupplyAfter).to.lessThan(totalSupplyBefore);
    });

    it("Should be possible to mint", async () => {
      const { token, companyLiquidityWallet, minterWallet } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const totalSupplyBefore = await token.totalSupply();

      await token.connect(companyLiquidityWallet).burn(ethers.utils.parseEther("1"));

      await token
        .connect(minterWallet)
        .mint(companyLiquidityWallet.address, ethers.utils.parseEther("1"));

      const totalSupplyAfterAfter = await token.totalSupply();

      expect(totalSupplyBefore).to.be.equal(totalSupplyAfterAfter);
    });
  });

  describe("Minting restrictions", () => {
    it("Should be possible to get all mint-related utility data", async () => {
      const { token, minterWallet, companyLiquidityWallet } = await loadFixture(loadContract);

      expect(await token.minter()).to.not.be.equal(companyLiquidityWallet.address);
      expect(await token.minter()).to.be.equal(minterWallet.address);

      expect(await token.canMintNow()).to.be.equal(false);

      expect(await token.timeRestrictionForMintingSeconds()).to.be.equal(6 * 30 * 24 * 60 * 60);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime + 7 * 30 * 24 * 60 * 60]);

      await token
        .connect(minterWallet)
        .mint(companyLiquidityWallet.address, ethers.utils.parseEther("2"));

      expect(startTime).to.be.lessThan(await token.lastMintTimestamp());
    });

    it("Should be possible to mint more tokens once every six months", async () => {
      const { token, companyLiquidityWallet, minterWallet } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const tokenSupplyBeginning = await token.totalSupply();

      // await expect(token.mint(companyLiquidityWallet.address, tokenSupplyBeginning.div(9))).to.revertedWith(
      //   `AccessControl: account ${companyLiquidityWallet.address} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
      // );

      await expect(
        token
          .connect(minterWallet)
          .mint(companyLiquidityWallet.address, tokenSupplyBeginning.div(9))
      ).to.revertedWith("Mint >10% total supply");

      await token
        .connect(minterWallet)
        .mint(companyLiquidityWallet.address, tokenSupplyBeginning.div(10));

      const tokenSupplyAfterFirst = await token.totalSupply();

      expect(tokenSupplyBeginning).to.lessThan(tokenSupplyAfterFirst);

      await expect(
        token
          .connect(minterWallet)
          .mint(companyLiquidityWallet.address, tokenSupplyBeginning.div(10))
      ).to.revertedWith("Last mint too close");

      await ethers.provider.send("evm_mine", [startTime + 6.1 * 30 * 24 * 60 * 60]);

      await token
        .connect(minterWallet)
        .mint(companyLiquidityWallet.address, tokenSupplyBeginning.div(10));
      const tokenSupplyAfterSecond = await token.totalSupply();

      expect(tokenSupplyAfterFirst).to.lessThan(tokenSupplyAfterSecond);
    });

    it("Reverts when minting called by a non-mint admin", async () => {
      const { token, addr1 } = await loadFixture(loadContract);
      await expect(token.connect(addr1).mint(addr1.address, 1)).to.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
      );
    });
  });

  describe("Strategic wallet transfer restrictions", () => {
    it("Should be possible to get utility data", async () => {
      const {
        token,
        companyLiquidityWallet,
        allocationsWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet,
        addr1,
        addr2
      } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const approvedLimit = ethers.utils.parseEther("1");

      await token
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(companyLiquidityWallet.address, addr1.address, approvedLimit);

      expect(await token.isStrategicWallet(companyLiquidityWallet.address)).to.be.equal(true);
      expect(await token.isStrategicWallet(feelessAdminWallet.address)).to.be.equal(false);
      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(false);
      expect(await token.getApprovedReceiver(companyLiquidityWallet.address)).to.be.equal(
        addr1.address
      );
      expect(await token.getApprovedReceiverLimit(companyLiquidityWallet.address)).to.be.equal(
        approvedLimit
      );
      expect(await token.companyLiquidityTransfersLimit()).to.be.equal(
        ethers.utils.parseEther(`${maxCompanyWalletTransfer}`)
      );
      expect(await token.companyLiquidityTransfersSinceLastLimitReached()).to.be.equal(
        ethers.utils.parseEther("0")
      );
      expect(await token.timeSinceCompanyLiquidityTransferLimitReached()).to.be.lessThanOrEqual(
        Date.now()
      );

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .removeUnrestrictedReceiver(companyLiquidityWallet.address)
      ).not.to.be.reverted;

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .addUnrestrictedReceiver(
            companyLiquidityWallet.address,
            companyRestrictionWhitelistWallet.address,
            1
          )
      ).to.revertedWith("Unrestrictor corruption guard");

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .addUnrestrictedReceiver(addr1.address, addr2.address, 1)
      ).to.revertedWith("Unrestricted wallet");

      await token
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(allocationsWallet.address, addr2.address, 1);

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .addUnrestrictedReceiver(allocationsWallet.address, addr1.address, 1)
      ).to.revertedWith("Cannot set unrestricted");

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .removeUnrestrictedReceiver(allocationsWallet.address)
      ).to.revertedWith("Cannot remove allowance");
    });

    it("Should not be possible to transfer more than 5m tokens for at least 1 month from the company wallet", async () => {
      const { token, companyLiquidityWallet, feelessAdminWallet, addr1 } = await loadFixture(
        loadContract
      );

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.utils.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit.sub(limit.mul(1).div(1000));
      const closeToLimitPlusOne = ethers.utils.parseEther("300000");
      const closeToLimitPlusTwo = ethers.utils.parseEther("400000");

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);

      await token.transfer(addr1.address, closeToLimit);

      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.be.equal(closeToLimit);

      const companyLiquidityWalletBalance = await token.balanceOf(companyLiquidityWallet.address);

      const expectedBalanceAfter = expectedBalanceBefore.sub(closeToLimit);

      expect(companyLiquidityWalletBalance).to.be.equal(expectedBalanceAfter);

      expect(await token.transfer(addr1.address, closeToLimitPlusOne))
        .to.emit("BITMarketsToken", "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address);

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);

      await expect(token.transfer(addr1.address, closeToLimitPlusTwo)).to.revertedWith(
        "Last max transfer too close"
      );

      await ethers.provider.send("evm_mine", [startTime + 1.2 * 30 * 24 * 60 * 60]);

      const onTheLimit = ethers.utils.parseEther("500000");

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(false);

      await token.transfer(addr1.address, onTheLimit);

      const companyLiquidityWalletNewBalance = await token.balanceOf(
        companyLiquidityWallet.address
      );

      expect(companyLiquidityWalletNewBalance).to.be.equal(
        (await token.totalSupply()).sub(closeToLimit.add(closeToLimitPlusOne.add(onTheLimit)))
      );
    });

    it("Should not be possible to approve more than 5m tokens for at least 1 month from the company wallet", async () => {
      const { token, companyLiquidityWallet, feelessAdminWallet, addr1, addr2 } = await loadFixture(
        loadContract
      );

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.utils.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit.sub(limit.mul(1).div(1000));
      const closeToLimitPlusOne = ethers.utils.parseEther("300000");

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);

      await token
        .connect(companyLiquidityWallet)
        .approve(addr1.address, closeToLimit.add(closeToLimit));

      await token
        .connect(addr1)
        .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimit);

      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance).to.be.equal(closeToLimit);

      const companyLiquidityWalletBalance = await token.balanceOf(companyLiquidityWallet.address);

      const expectedBalanceAfter = expectedBalanceBefore.sub(closeToLimit);

      expect(companyLiquidityWalletBalance).to.be.equal(expectedBalanceAfter);

      expect(
        await token
          .connect(addr1)
          .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimitPlusOne)
      )
        .to.emit("BITMarketsToken", "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address);

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);
    });

    it("Should be possible to reach the limit of approved receiver with allowance", async () => {
      const {
        token,
        companyLiquidityWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet,
        addr1,
        addr2
      } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.utils.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit.sub(limit.mul(1).div(1000));
      const closeToLimitPlusOne = ethers.utils.parseEther("300000");

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);

      await token
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(companyLiquidityWallet.address, addr2.address, closeToLimit);

      await token
        .connect(companyLiquidityWallet)
        .approve(addr1.address, closeToLimit.add(closeToLimit));

      await token
        .connect(addr1)
        .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimit);

      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance).to.be.equal(closeToLimit);

      const companyLiquidityWalletBalance = await token.balanceOf(companyLiquidityWallet.address);

      const expectedBalanceAfter = expectedBalanceBefore.sub(closeToLimit);

      expect(companyLiquidityWalletBalance).to.be.equal(expectedBalanceAfter);

      expect(
        await token
          .connect(addr1)
          .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimitPlusOne)
      )
        .to.emit("BITMarketsToken", "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address);

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(false);
    });

    it("Should be possible to reach the limit of approved receiver with transfers", async () => {
      const {
        token,
        companyLiquidityWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet,
        addr1,
        addr2
      } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.utils.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit.sub(limit.mul(1).div(1000));
      const closeToLimitPlusOne = ethers.utils.parseEther("300000");

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);

      await token
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(companyLiquidityWallet.address, addr2.address, closeToLimit);

      await token
        .connect(companyLiquidityWallet)
        .transfer(addr1.address, closeToLimit.sub(ethers.utils.parseEther("0.1")));

      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.be.equal(closeToLimit.sub(ethers.utils.parseEther("0.1")));

      const companyLiquidityWalletBalance = await token.balanceOf(companyLiquidityWallet.address);

      const expectedBalanceAfter = expectedBalanceBefore.sub(
        closeToLimit.sub(ethers.utils.parseEther("0.1"))
      );

      expect(companyLiquidityWalletBalance).to.be.equal(expectedBalanceAfter);

      expect(
        await token.connect(companyLiquidityWallet).transfer(addr2.address, closeToLimitPlusOne)
      )
        .to.emit("BITMarketsToken", "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address);

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(false);
    });
  });

  describe("Pausable", () => {
    it("Disallows transfers when paused and allows them when unpaused", async () => {
      const { token, companyLiquidityWallet, addr1, pauserWallet } = await loadFixture(
        loadContract
      );

      await token.connect(pauserWallet).pause();

      await expect(
        token.transfer(addr1.address, 100, { from: companyLiquidityWallet.address })
      ).to.revertedWith("ERC20Pausable: token transfer while paused");

      await token.connect(pauserWallet).unpause();

      await token.transfer(addr1.address, 100, { from: companyLiquidityWallet.address });

      expect(await token.balanceOf(addr1.address)).to.equal(100);
    });

    const allowance = 100;

    it("Disallows transfers from allowance when paused and allows them after unpaused", async () => {
      const { token, companyLiquidityWallet, addr1, addr2, pauserWallet } = await loadFixture(
        loadContract
      );

      await token.approve(addr1.address, allowance, { from: companyLiquidityWallet.address });

      await token.connect(pauserWallet).pause();

      await expect(
        token.connect(addr1).transferFrom(companyLiquidityWallet.address, addr2.address, 100)
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");

      await token.connect(pauserWallet).unpause();

      await token.connect(addr1).transferFrom(companyLiquidityWallet.address, addr2.address, 100);

      expect(await token.balanceOf(addr2.address)).to.equal(100);
    });

    it("Disallows burning when paused and allows when unpaused", async () => {
      const { token, addr2, pauserWallet } = await loadFixture(loadContract);

      await token.transfer(addr2.address, 10000);

      await token.connect(pauserWallet).pause();

      await expect(token.burn(5000)).to.be.revertedWith(
        "ERC20Pausable: token transfer while paused"
      );
    });

    it("Reverts when pause called by a non-pause admin", async () => {
      const { token, addr1 } = await loadFixture(loadContract);
      await expect(token.connect(addr1).pause()).to.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a`
      );
    });

    it("Reverts when unpaused called by a non-pause admin", async () => {
      const { token, addr1, pauserWallet } = await loadFixture(loadContract);
      await token.connect(pauserWallet).pause();
      await expect(token.connect(addr1).pause()).to.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a`
      );
    });
  });

  describe("Snapshots", () => {
    it("Emits event", async () => {
      const { token } = await loadFixture(loadContract);

      const receipt = await token.snapshot();
      expect(receipt).to.emit("BITMarketsToken", "Snapshot");
    });

    it("Creates increasing snapshots ids, starting from 1", async () => {
      const { token } = await loadFixture(loadContract);
      for (const id of ["1", "2", "3", "4", "5"]) {
        const receipt = await token.snapshot();
        expect(receipt).to.emit("BITMarketsToken", "Snapshot").withArgs(id);
      }
    });

    it("Reverts with a snapshot id of 0", async () => {
      const { token } = await loadFixture(loadContract);
      await expect(token.totalSupplyAt(0)).to.be.revertedWith("ERC20Snapshot: id is 0");
    });

    it("Reverts with a not-yet-created snapshot id", async () => {
      const { token } = await loadFixture(loadContract);
      await expect(token.totalSupplyAt(1)).to.be.revertedWith("ERC20Snapshot: nonexistent id");
    });

    it("Reverts when snapshot called by a non-snapshot admin", async () => {
      const { token, addr1 } = await loadFixture(loadContract);
      await expect(token.connect(addr1).snapshot()).to.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role 0x5fdbd35e8da83ee755d5e62a539e5ed7f47126abede0b8b10f9ea43dc6eed07f`
      );
    });
  });

  describe("Blacklist", () => {
    it("Should disallow transfers from blacklisted people.", async () => {
      const { token, companyLiquidityWallet, addr1, addr2, blacklisterWallet } = await loadFixture(
        loadContract
      );

      await token.transfer(addr1.address, 100, { from: companyLiquidityWallet.address });

      await token.connect(blacklisterWallet).addBlacklisted(addr1.address);

      await expect(
        token.connect(addr1).transfer(addr2.address, 50, { from: addr1.address })
      ).to.be.revertedWith("From is blacklisted");
    });

    it("Should disallow transfers to blacklisted people.", async () => {
      const { token, companyLiquidityWallet, addr1, addr2, blacklisterWallet } = await loadFixture(
        loadContract
      );

      await token.transfer(addr1.address, 100, { from: companyLiquidityWallet.address });

      await token.connect(blacklisterWallet).addBlacklisted(addr2.address);

      await expect(
        token.connect(addr1).transfer(addr2.address, 50, { from: addr1.address })
      ).to.be.revertedWith("To is blacklisted");
    });

    it("Should disallow transfers with blacklisted people as msg sender.", async () => {
      const { token, addr1, addr2, blacklisterWallet } = await loadFixture(loadContract);

      await token.transfer(addr1.address, 100);

      await token.connect(addr1).approve(addr2.address, 50);

      await token.connect(blacklisterWallet).addBlacklisted(addr2.address);

      await expect(
        token.connect(addr2).transferFrom(addr1.address, blacklisterWallet.address, 50)
      ).to.be.revertedWith("Sender is blacklisted");
    });

    it("Should disallow blacklisting from non-admin.", async () => {
      const { token, addr1, addr2 } = await loadFixture(loadContract);

      await expect(token.connect(addr1).addBlacklisted(addr2.address)).to.be.revertedWith(
        "Caller not blacklister"
      );

      expect(await token.connect(addr1).isBlacklistAdmin(addr1.address)).to.be.equal(false);
    });

    it("Should disallow unblacklisting from non-admin.", async () => {
      const { token, addr1, addr2 } = await loadFixture(loadContract);

      await expect(token.connect(addr1).removeBlacklisted(addr2.address)).to.be.revertedWith(
        "Caller not blacklister"
      );

      expect(await token.connect(addr1).isBlacklistAdmin(addr1.address)).to.be.equal(false);
    });

    it("Should disallow blacklisting of zero address.", async () => {
      const { token, blacklisterWallet } = await loadFixture(loadContract);

      await expect(
        token.connect(blacklisterWallet).addBlacklisted(ethers.constants.AddressZero)
      ).to.be.revertedWith("Account is zero");
    });

    it("Should disallow unblacklisting of zero address.", async () => {
      const { token, blacklisterWallet } = await loadFixture(loadContract);

      await expect(
        token.connect(blacklisterWallet).removeBlacklisted(ethers.constants.AddressZero)
      ).to.be.revertedWith("Account is zero");
    });

    it("Should disallow repeated blacklisting.", async () => {
      const { token, addr1, blacklisterWallet } = await loadFixture(loadContract);

      await token.connect(blacklisterWallet).addBlacklisted(addr1.address);

      await expect(
        token.connect(blacklisterWallet).addBlacklisted(addr1.address)
      ).to.be.revertedWith("Account already blacklisted");
    });

    it("Should allow blacklisting.", async () => {
      const { token, addr1, blacklisterWallet } = await loadFixture(loadContract);

      expect(await token.connect(blacklisterWallet).addBlacklisted(addr1.address)).to.emit(
        "BITMarketsToken",
        "Caller added to blacklist"
      );
    });

    it("Should allow de-blacklisting.", async () => {
      const { token, addr1, blacklisterWallet } = await loadFixture(loadContract);

      await token.connect(blacklisterWallet).addBlacklisted(addr1.address);

      expect(await token.connect(blacklisterWallet).removeBlacklisted(addr1.address)).to.emit(
        "BITMarketsToken",
        "Caller removed from blacklist"
      );
    });
  });
});
