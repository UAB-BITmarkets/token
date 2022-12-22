import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";

const initialSupply = 300000000;
// const finalSupply = 200000000;
// const burnRate = 1; // 1/1000 = 0.1%
const companyRate = 1;
const fundRate = 1;

const companyRewardsWallet = ethers.Wallet.createRandom();

const someRandomWallet = ethers.Wallet.createRandom();

describe("BITMarkets ERC20 token contract tests", () => {
  const loadContract = async () => {
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

    return { token, owner, addr1, addr2 };
  };

  describe("Deployment", () => {
    it("Should assign the total supply of tokens to the owner", async () => {
      const { token, owner } = await loadFixture(loadContract);
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Transactions", () => {
    it("Should transfer tokens between accounts", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      // Transfer 50 tokens from owner to addr1
      await token.transfer(addr1.address, 50, { from: owner.address });
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await token.connect(addr1).transfer(addr2.address, 50, { from: addr1.address });
      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it("Should fail if sender doesn’t have enough tokens", async () => {
      const { token, owner, addr1 } = await loadFixture(loadContract);
      const initialOwnerBalance = await token.balanceOf(owner.address);

      // Try to send 1 token from addr1 (0 tokens) to owner (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(
        token.connect(addr1).transfer(owner.address, 1, { from: addr1.address })
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed.
      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should update balances after transfers", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      const initialOwnerBalance = await token.balanceOf(owner.address);

      // Transfer 100 tokens from owner to addr1.
      await token.transfer(addr1.address, 100, { from: owner.address });

      // Transfer another 50 tokens from owner to addr2.
      await token.transfer(addr2.address, 50, { from: owner.address });

      // Check balances.
      const finalOwnerBalance = await token.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(150));

      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(100);

      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it("Should add transaction fees to the esg fund, the company rewards and burn from company wallet with each transfer", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const esgFundBalanceBefore = await token.balanceOf(addr1.address);
      const companyRewardsBalanceBefore = await token.balanceOf(companyRewardsWallet.address);
      const companyWalletBalanceBefore = await token.balanceOf(owner.address);

      await owner.sendTransaction({
        to: someRandomWallet.address,
        value: ethers.utils.parseEther("1.0")
      });

      // Transfer 100 tokens from owner to addr2. Does not induce fees because owner is feeless.
      await token.transfer(addr2.address, ethers.utils.parseEther("1.0"), { from: owner.address });

      const nextTime = startTime + 10 * 1000; // 10s
      await ethers.provider.send("evm_mine", [nextTime]);

      // Transfer 40 tokens from addr2 to someRandomWallet. Should induce fees.
      await token
        .connect(addr2)
        .transfer(someRandomWallet.address, ethers.utils.parseEther("0.4"), {
          from: addr2.address
        });

      const esgFundBalanceAfter = await token.balanceOf(addr1.address);
      expect(esgFundBalanceBefore).to.be.lessThan(esgFundBalanceAfter);

      const companyRewardsBalanceAfter = await token.balanceOf(companyRewardsWallet.address);
      expect(companyRewardsBalanceBefore).to.be.lessThan(companyRewardsBalanceAfter);

      const companyWalletBalanceAfter = await token.balanceOf(owner.address);
      expect(companyWalletBalanceAfter).to.be.lessThan(companyWalletBalanceBefore);
    });

    // it("Should induce burning with each transfer", async () => {
    //   const { token, owner, addr2 } = await loadFixture(loadContract);
    //
    //   const startTime = Date.now();
    //   await ethers.provider.send("evm_mine", [startTime]);
    //
    //   const totalSupplyBefore = await token.totalSupply();
    //
    //   // Transfer 100 tokens from owner to addr2.
    //   const addr2Transfer = ethers.utils.parseEther("1.0");
    //   await token.transfer(addr2.address, addr2Transfer, { from: owner.address });
    //
    //   const nextTime = startTime + 60 * 1000; // 1min
    //   await ethers.provider.send("evm_mine", [nextTime]);
    //
    //   const totalSupplyAfter = await token.totalSupply();
    //
    //   expect(totalSupplyAfter).to.be.lessThan(totalSupplyBefore);
    // });

    it("Should be possible to do feeless transfers", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      expect(await token.addFeeless(someRandomWallet.address)).to.emit(
        "BITMarketsToken",
        "Caller added to feeless"
      );

      await expect(token.connect(addr1).addFeeless(addr2.address)).to.revertedWith(
        "Not feeless admin"
      );

      await expect(token.addFeeless(ethers.constants.AddressZero)).to.revertedWith(
        "Account is zero"
      );

      await expect(token.addFeeless(someRandomWallet.address)).to.revertedWith(
        "Account already feeless"
      );

      await token.addFeeless(addr2.address);
      const someOtherRandomWallet = ethers.Wallet.createRandom();
      await expect(token.addFeeless(someOtherRandomWallet.address)).to.revertedWith(
        "Feeless limit reached"
      );

      expect(await token.removeFeeless(someRandomWallet.address)).to.emit(
        "BITMarketsToken",
        "Caller removed from feeless"
      );

      await expect(token.removeFeeless(ethers.constants.AddressZero)).to.revertedWith(
        "Account is zero"
      );

      const randomWallet = ethers.Wallet.createRandom();
      await token.addFeeless(randomWallet.address);

      await token.transfer(addr2.address, ethers.utils.parseEther("1.0"), {
        from: owner.address
      });

      const nextTime = startTime + 10 * 1000; // 10s
      await ethers.provider.send("evm_mine", [nextTime]);

      const esgFundBalanceBefore = await token.balanceOf(addr1.address);
      const companyRewardsBalanceBefore = await token.balanceOf(companyRewardsWallet.address);
      const companyWalletBalanceBefore = await token.balanceOf(owner.address);
      const randomWalletBalanceBefore = await token.balanceOf(randomWallet.address);

      await token
        .connect(addr2)
        .transfer(randomWallet.address, ethers.utils.parseEther("0.2"), { from: addr2.address });

      const nextNextTime = startTime + 20 * 1000; // 20s
      await ethers.provider.send("evm_mine", [nextNextTime]);

      const esgFundBalanceAfter = await token.balanceOf(addr1.address);
      expect(esgFundBalanceBefore).to.equal(esgFundBalanceAfter);

      const companyRewardsBalanceAfter = await token.balanceOf(companyRewardsWallet.address);
      expect(companyRewardsBalanceBefore).to.equal(companyRewardsBalanceAfter);

      const companyWalletBalanceAfter = await token.balanceOf(owner.address);
      expect(companyWalletBalanceAfter).to.equal(companyWalletBalanceBefore);

      const randomWalletBalanceAfter = await token.balanceOf(randomWallet.address);
      expect(randomWalletBalanceBefore).to.be.lessThan(randomWalletBalanceAfter);
    });
  });

  describe("Pausable", () => {
    it("Disallows transfers when paused and allows them when unpaused", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      await token.connect(addr2).pause();

      await expect(token.transfer(addr1.address, 100, { from: owner.address })).to.revertedWith(
        "ERC20Pausable: token transfer while paused"
      );

      await token.connect(addr2).unpause();

      await token.transfer(addr1.address, 100, { from: owner.address });

      expect(await token.balanceOf(addr1.address)).to.equal(100);
    });

    const allowance = 100;

    it("Disallows transfers from allowance when paused and allows them after unpaused", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      await token.approve(addr1.address, allowance, { from: owner.address });

      await token.connect(addr2).pause();

      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, 100)
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");

      await token.connect(addr2).unpause();

      await token.connect(addr1).transferFrom(owner.address, addr2.address, 100);

      expect(await token.balanceOf(addr2.address)).to.equal(100);
    });

    // it("Disallows burning when paused and allows when unpaused", async () => {
    //   const { token, owner, addr2 } = await loadFixture(loadContract);
    //
    //   await token.transfer(addr2.address, 10000);
    //
    //   await token.connect(addr2).pause();
    //
    //   await expect(token.burn(5000)).to.be.revertedWith("Pausable: paused");
    //
    //   await token.connect(addr2).unpause();
    //
    //   const ownerTokenBalance = await token.balanceOf(owner.address);
    //   await token.connect(addr2).burnFrom(owner.address, 50000);
    //
    //   expect(await token.balanceOf(owner.address)).to.lessThan(ownerTokenBalance);
    // });
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
  });

  describe("Blacklist", () => {
    it("Should disallow transfers from blacklisted people.", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      await token.transfer(addr1.address, 100, { from: owner.address });

      await token.addBlacklisted(addr1.address);

      await expect(
        token.connect(addr1).transfer(addr2.address, 50, { from: addr1.address })
      ).to.be.revertedWith("From is blacklisted");
    });

    it("Should disallow transfers to blacklisted people.", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      await token.transfer(addr1.address, 100, { from: owner.address });

      await token.addBlacklisted(addr2.address);

      await expect(
        token.connect(addr1).transfer(addr2.address, 50, { from: addr1.address })
      ).to.be.revertedWith("To is blacklisted");
    });

    it("Should disallow blacklisting from non-admin.", async () => {
      const { token, addr1, addr2 } = await loadFixture(loadContract);

      await expect(token.connect(addr1).addBlacklisted(addr2.address)).to.be.revertedWith(
        "Caller not blacklist admin"
      );
    });

    it("Should disallow repeated blacklisting.", async () => {
      const { token, addr1 } = await loadFixture(loadContract);

      await token.addBlacklisted(addr1.address);

      await expect(token.addBlacklisted(addr1.address)).to.be.revertedWith(
        "Account already blacklisted"
      );
    });

    it("Should allow blacklisting.", async () => {
      const { token, addr1 } = await loadFixture(loadContract);

      expect(await token.addBlacklisted(addr1.address)).to.emit(
        "BITMarketsToken",
        "Caller added to blacklist"
      );
    });

    it("Should allow de-blacklisting.", async () => {
      const { token, addr1 } = await loadFixture(loadContract);

      await token.addBlacklisted(addr1.address);

      expect(await token.removeBlacklisted(addr1.address)).to.emit(
        "BITMarketsToken",
        "Caller removed from blacklist"
      );
    });
  });
});
