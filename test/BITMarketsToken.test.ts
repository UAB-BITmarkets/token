import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { loadContract } from "./token/fixture";
// import { allocationsWallet } from "../utils/testAccounts";

const initialSupply = 300000000;

const companyWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 10;

const someRandomWallet = ethers.Wallet.createRandom();

describe("BITMarkets ERC20 token contract tests", () => {
  describe("Transactions", () => {
    it("Should transfer tokens between accounts", async () => {
      const { token, companyLiquidityWallet, addr1, addr2 } = await loadFixture(loadContract);

      // Transfer 50 tokens from companyLiquidityWallet to addr1
      const addr1TransferredAmount = ethers.parseEther("50");

      // const totalSupplyBefore = await token.totalSupply();
      const companyLiquidityWalletBalanceBefore = await token.balanceOf(
        companyLiquidityWallet.address
      );
      const addr1BalanceBefore = await token.balanceOf(addr1.address);
      await token.connect(companyLiquidityWallet).transfer(addr1.address, addr1TransferredAmount);

      // const totalSupplyAfter = await token.totalSupply();
      // const companyLiquidityWalletBalanceAfter = await token.balanceOf(companyLiquidityWallet.address);
      const addr1BalanceAfter = await token.balanceOf(addr1.address);

      // expect(totalSupplyAfter).to.be.lessThan(totalSupplyBefore);
      expect(addr1BalanceBefore).to.be.lessThan(addr1BalanceAfter);
      expect(await token.balanceOf(companyLiquidityWallet.address)).to.be.equal(
        companyLiquidityWalletBalanceBefore -
          addr1TransferredAmount -
          (addr1TransferredAmount * BigInt(3)) / BigInt(1000)
      );
      // expect(addr1BalanceAfter).to.be.equal(addr1BalanceBefore.sub(addr1TransferredAmount));
      // expect(addr1BalanceAfter.lt(addr1TransferredAmount)).to.be.equal(true);

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.parseEther("49.9"))
      ).to.revertedWith("Not enough to pay");

      const addr2TransferredAmount = ethers.parseEther("40");
      await token.connect(addr1).transfer(addr2.address, addr2TransferredAmount);

      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance === addr2TransferredAmount).to.equal(true);
    });

    it("Should fail if sender doesn’t have enough tokens", async () => {
      const { token, companyLiquidityWallet, addr1 } = await loadFixture(loadContract);

      // Try to send 1 token from addr1 (0 tokens) to companyLiquidityWallet (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(
        token.connect(addr1).transfer(companyLiquidityWallet.address, 1, { from: addr1.address })
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // const superHighAmount = ethers.parseEther(`${companyWalletTokens + 1}`);
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
        value: ethers.parseEther("1.0")
      });

      // Transfer 100 tokens from companyLiquidityWallet to addr2. Does not induce fees because companyLiquidityWallet is feeless.
      await token.transfer(addr2.address, ethers.parseEther("1.0"));

      const nextTime = startTime + 10; // 10s
      await ethers.provider.send("evm_mine", [nextTime]);

      // Transfer 40 tokens from addr2 to someRandomWallet. Should induce fees.
      await token.connect(addr2).transfer(someRandomWallet.address, ethers.parseEther("0.4"));

      const totalSupplyAfter = await token.totalSupply();

      const companyRewardsBalanceAfter = await token.balanceOf(companyRewardsWallet.address);
      expect(companyRewardsBalanceBefore).to.be.lessThan(companyRewardsBalanceAfter);

      const esgFundBalanceAfter = await token.balanceOf(esgFundWallet.address);
      expect(esgFundBalanceBefore).to.be.lessThan(esgFundBalanceAfter);

      expect(totalSupplyAfter).to.be.lessThan(totalSupplyBefore);
    });

    it("Should not burn from transfers if final supply reached.", async () => {
      const { token, companyLiquidityWallet, addr1, addr2 } = await loadFixture(loadContract);

      const balance = await token.balanceOf(companyLiquidityWallet.address);

      await token.connect(companyLiquidityWallet).transfer(addr2.address, ethers.parseEther("100"));
      await token.connect(companyLiquidityWallet).burn(balance / BigInt(3));

      const totalSupplyBefore = await token.totalSupply();

      await token.connect(addr2).transfer(addr1.address, ethers.parseEther("50"));

      const totalSupplyAfter = await token.totalSupply();

      expect(totalSupplyBefore).to.be.equal(totalSupplyAfter);
    });

    it("Should reverse if not enough for fees and burning from transfers.", async () => {
      const { token, companyLiquidityWallet, addr1, addr2 } = await loadFixture(loadContract);

      const transferBalance = ethers.parseEther("100");

      await token.connect(companyLiquidityWallet).transfer(addr2.address, transferBalance);

      await expect(
        token.connect(addr2).transfer(addr1.address, transferBalance)
      ).to.be.revertedWith("Not enough to pay");
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

      await expect(token.connect(feelessAdminWallet).addFeeless(someRandomWallet.address))
        .to.emit(token, "FeelessAdded")
        .withArgs(someRandomWallet.address);

      expect(await token.isFeeless(someRandomWallet.address)).to.be.equal(true);

      await expect(token.connect(addr1).addFeeless(addr2.address)).to.revertedWith(
        "Caller not in feeless admins"
      );

      await expect(
        token.connect(feelessAdminWallet).addFeeless(ethers.ZeroAddress)
      ).to.revertedWith("Account is zero");

      await expect(
        token.connect(feelessAdminWallet).addFeeless(someRandomWallet.address)
      ).to.revertedWith("Account already feeless");

      await token.connect(feelessAdminWallet).addFeeless(addr2.address);

      const someOtherRandomWallet = ethers.Wallet.createRandom();
      token.connect(feelessAdminWallet).addFeeless(someOtherRandomWallet.address);

      await expect(token.connect(feelessAdminWallet).removeFeeless(someRandomWallet.address))
        .to.emit(token, "FeelessRemoved")
        .withArgs(someRandomWallet.address);

      await expect(
        token.connect(feelessAdminWallet).removeFeeless(ethers.ZeroAddress)
      ).to.revertedWith("Account is zero");

      const randomWallet = ethers.Wallet.createRandom();

      await token.connect(feelessAdminWallet).addFeeless(randomWallet.address);

      await token.transfer(addr2.address, ethers.parseEther("1.0"), {
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
        .transfer(randomWallet.address, ethers.parseEther("0.2"), { from: addr2.address });

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

    it("Should not be possible to make some address feeless if not feeless admin.", async () => {
      const { token, addr1, feelessAdminWallet } = await loadFixture(loadContract);

      await expect(token.addFeelessAdmin(addr1.address)).to.be.revertedWith(
        "Caller not feeless admin"
      );

      await expect(
        token.connect(feelessAdminWallet).addFeelessAdmin(feelessAdminWallet.address)
      ).to.be.revertedWith("Already feeless admin");

      await expect(token.removeFeeless(addr1.address)).to.be.revertedWith(
        "Caller not in feeless admins"
      );
    });
  });

  describe("Burning", () => {
    it("Should be possible to burn", async () => {
      const { token, companyLiquidityWallet } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const totalSupplyBefore = await token.totalSupply();

      await token.connect(companyLiquidityWallet).burn(ethers.parseEther("1"));

      const totalSupplyAfter = await token.totalSupply();

      expect(totalSupplyAfter).to.lessThan(totalSupplyBefore);
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

      const approvedLimit = ethers.parseEther("1");

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
        ethers.parseEther(`${maxCompanyWalletTransfer}`)
      );
      expect(await token.companyLiquidityTransfersSinceLastLimitReached()).to.be.equal(
        ethers.parseEther("0")
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

      await expect(token.connect(allocationsWallet).transfer(addr1.address, 1)).to.revertedWith(
        "Illegal transfer"
      );

      await expect(token.connect(companyLiquidityWallet).transfer(addr1.address, 1)).to.not.be
        .reverted;

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
      ).to.emit(token, "UnrestrictedReceiverRemoved");

      await expect(
        token.connect(addr1).addUnrestrictedReceiver(allocationsWallet.address, addr1.address, 1)
      ).to.revertedWith("Only restrictor");

      await expect(
        token.connect(addr1).removeUnrestrictedReceiver(allocationsWallet.address)
      ).to.revertedWith("Only restrictor");
    });

    it("Should not be possible to transfer more than 5m tokens for at least 1 month from the company wallet", async () => {
      const { token, companyLiquidityWallet, feelessAdminWallet, addr1 } =
        await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit - BigInt(3);
      const closeToLimitPlusTwo = limit - BigInt(1);

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);

      await token.connect(companyLiquidityWallet).transfer(addr1.address, closeToLimit);

      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.be.equal(closeToLimit);

      const companyLiquidityWalletBalance = await token.balanceOf(companyLiquidityWallet.address);
      const expectedBalanceAfter = expectedBalanceBefore - closeToLimit;
      expect(companyLiquidityWalletBalance).to.be.equal(expectedBalanceAfter);

      await expect(token.transfer(addr1.address, 3))
        .to.emit(token, "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address);

      const addr1BalanceAfter = await token.balanceOf(addr1.address);
      expect(addr1BalanceAfter).to.be.equal(limit);

      await token.connect(companyLiquidityWallet).approve(addr1.address, ethers.parseEther("1"));

      await expect(
        token
          .connect(addr1)
          .transferFrom(companyLiquidityWallet.address, addr1.address, ethers.parseEther("1"))
      ).to.revertedWith("Last max transfer too close");

      await expect(token.transfer(addr1.address, closeToLimitPlusTwo)).to.revertedWith(
        "Last max transfer too close"
      );

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);
      await ethers.provider.send("evm_mine", [startTime + 1.2 * 30 * 24 * 60 * 60]);
      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(false);

      const onTheLimit = ethers.parseEther("500000");

      await token.transfer(addr1.address, onTheLimit);

      const companyLiquidityWalletNewBalance = await token.balanceOf(
        companyLiquidityWallet.address
      );

      expect(companyLiquidityWalletNewBalance).to.be.equal(
        (await token.totalSupply()) - (limit + onTheLimit)
      );
    });

    it("Should not be possible to transferFrom more than 5m tokens for at least 1 month from the company wallet", async () => {
      const { token, companyLiquidityWallet, feelessAdminWallet, addr1, addr2 } =
        await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit - BigInt(2);
      const closeToLimitPlusOne = limit - BigInt(1);

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);

      await token
        .connect(companyLiquidityWallet)
        .approve(addr1.address, closeToLimitPlusOne + BigInt(2));

      await token
        .connect(addr1)
        .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimit);

      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance).to.be.equal(closeToLimit);

      const companyLiquidityWalletBalance = await token.balanceOf(companyLiquidityWallet.address);

      const expectedBalanceAfter = expectedBalanceBefore - closeToLimit;

      expect(companyLiquidityWalletBalance).to.be.equal(expectedBalanceAfter);

      await expect(
        token.connect(addr1).transferFrom(companyLiquidityWallet.address, addr2.address, 3)
      ).to.revertedWith("Amount > transfer limit");

      await expect(
        token.connect(addr1).transferFrom(companyLiquidityWallet.address, addr2.address, 2)
      )
        .to.emit(token, "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address);

      const addr2BalanceAfter = await token.balanceOf(addr2.address);
      expect(addr2BalanceAfter).to.be.equal(limit);

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);
    });

    it("Should be possible to do only one transferFrom from company liquidity below the limit to an approved receiver when liquidity locked", async () => {
      const {
        token,
        companyLiquidityWallet,
        crowdsalesWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet,
        addr1,
        addr2
      } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit - BigInt(2);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);
      await token.connect(companyLiquidityWallet).approve(addr2.address, limit);
      await token.connect(addr2).transferFrom(companyLiquidityWallet.address, addr1.address, limit);

      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .addUnrestrictedReceiver(companyLiquidityWallet.address, addr2.address, closeToLimit)
      )
        .to.emit(token, "UnrestrictedReceiverAdded")
        .withArgs(companyLiquidityWallet.address, addr2.address, closeToLimit);

      await token.connect(companyLiquidityWallet).approve(addr1.address, limit * BigInt(3));

      const approved = await token.getApprovedReceiver(companyLiquidityWallet.address);
      const lim = await token.getApprovedReceiverLimit(companyLiquidityWallet.address);
      expect(approved).to.be.equal(addr2.address);
      expect(lim).to.be.equal(closeToLimit);

      await expect(
        token
          .connect(addr1)
          .transferFrom(companyLiquidityWallet.address, addr2.address, limit * BigInt(4))
      ).to.be.revertedWith("ERC20: insufficient allowance");

      await expect(
        token
          .connect(addr1)
          .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimit + BigInt(1))
      ).to.be.revertedWith("Amount > approved limit");

      await expect(
        token
          .connect(addr1)
          .transferFrom(companyLiquidityWallet.address, addr2.address, closeToLimit)
      )
        .to.emit(token, "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address)
        .and.to.emit(token, "UnrestrictedTransferOccured")
        .withArgs(companyLiquidityWallet.address, addr2.address, closeToLimit);

      const addr2BalanceAfter = await token.balanceOf(addr2.address);
      expect(addr2BalanceAfter).to.be.equal(closeToLimit);

      const approvedAfter = await token.getApprovedReceiver(companyLiquidityWallet.address);
      expect(approvedAfter).to.be.equal(ethers.ZeroAddress);
      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);

      const remaining = await token.getApprovedReceiverRemaining(companyLiquidityWallet.address);
      expect(remaining).to.be.equal(BigInt(0));

      const approvedEths = ethers.parseEther("100000000");
      await token
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(
          companyLiquidityWallet.address,
          crowdsalesWallet.address,
          approvedEths
        );
      await token.transfer(crowdsalesWallet.address, approvedEths);
      await token
        .connect(companyRestrictionWhitelistWallet)
        .addUnrestrictedReceiver(crowdsalesWallet.address, addr2.address, approvedEths);
      await token.connect(crowdsalesWallet).approve(addr1.address, approvedEths);
      await expect(
        token
          .connect(addr1)
          .transferFrom(crowdsalesWallet.address, addr1.address, closeToLimit + BigInt(1))
      ).to.be.revertedWith("Receiver not approved");
    });

    it("Should be possible to do only one transfer from company liquidity below the limit to an approved receiver when liquidity locked", async () => {
      const {
        token,
        companyLiquidityWallet,
        feelessAdminWallet,
        companyRestrictionWhitelistWallet,
        addr2
      } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const limit = ethers.parseEther(`${maxCompanyWalletTransfer}`);
      const closeToLimit = limit - BigInt(1);

      const totalSupplyBefore = await token.totalSupply();
      const expectedBalanceBefore = await token.balanceOf(companyLiquidityWallet.address);

      expect(expectedBalanceBefore).to.be.equal(totalSupplyBefore);

      await token.connect(feelessAdminWallet).addFeeless(companyLiquidityWallet.address);
      await token.connect(companyLiquidityWallet).transfer(addr2.address, limit);
      expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);

      await expect(
        token
          .connect(companyRestrictionWhitelistWallet)
          .addUnrestrictedReceiver(companyLiquidityWallet.address, addr2.address, closeToLimit)
      )
        .to.emit(token, "UnrestrictedReceiverAdded")
        .withArgs(companyLiquidityWallet.address, addr2.address, closeToLimit);

      // await token.connect(companyLiquidityWallet).transfer(addr2.address, closeToLimit.sub(1));
      await expect(token.connect(companyLiquidityWallet).transfer(addr2.address, closeToLimit))
        .to.emit(token, "StrategicWalletCapReached")
        .withArgs(companyLiquidityWallet.address)
        .and.to.emit(token, "UnrestrictedTransferOccured")
        .withArgs(companyLiquidityWallet.address, addr2.address, closeToLimit);

      const addr2BalanceAfter = await token.balanceOf(addr2.address);
      expect(addr2BalanceAfter).to.be.equal(limit + closeToLimit);

      const approvedAfter = await token.getApprovedReceiver(companyLiquidityWallet.address);
      expect(approvedAfter).to.be.equal(ethers.ZeroAddress);

      const remaining = await token.getApprovedReceiverRemaining(companyLiquidityWallet.address);
      expect(remaining).to.be.equal(BigInt(0));

      // await expect(
      //   token.connect(companyLiquidityWallet).transfer(addr2.address, 1)
      //   // ).to.revertedWith("Sender surpassed approved limit");
      // ).to.revertedWith("Last max transfer too close");
      //
      // expect(await token.companyLiquidityTransfersAreRestricted()).to.be.equal(true);
    });
  });

  describe("Snapshots", () => {
    it("Emits event", async () => {
      const { token } = await loadFixture(loadContract);

      await expect(token.snapshot()).to.emit(token, "Snapshot");
    });

    it("Creates increasing snapshots ids, starting from 1", async () => {
      const { token } = await loadFixture(loadContract);
      for (const id of ["1", "2", "3", "4", "5"]) {
        await expect(token.snapshot()).to.emit(token, "Snapshot").withArgs(id);
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
});
