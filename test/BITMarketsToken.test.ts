import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";

const initialSupply = 300000000;
const finalSupply = 200000000;
const burnRate = 1; // 1/1000 = 0.1%
const buyBackRate = 1;
const fundRate = 1;

describe("BITMarkets ERC20 token contract tests", () => {
  const loadContract = async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const BITMarketsTokenFactory = (await ethers.getContractFactory(
      "BITMarketsToken",
      owner
    )) as BITMarketsToken__factory;

    const token = await BITMarketsTokenFactory.deploy(
      initialSupply,
      finalSupply,
      burnRate,
      buyBackRate,
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

    it("Should add transaction costs to the esg fund with each transfer", async () => {
      const { token, owner, addr1, addr2 } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const esgFundBalanceBefore = await token.balanceOf(addr1.address);

      // Transfer 100 tokens from owner to addr2.
      const addr2Transfer = ethers.utils.parseEther("1.0");
      await token.transfer(addr2.address, addr2Transfer, { from: owner.address });

      const nextTime = startTime + 10 * 1000; // 10s
      await ethers.provider.send("evm_mine", [nextTime]);

      const esgFundBalanceAfter = await token.balanceOf(addr1.address);
      expect(esgFundBalanceBefore).to.be.lessThan(esgFundBalanceAfter);
    });

    it("Should induce burning with each transfer", async () => {
      const { token, owner, addr2 } = await loadFixture(loadContract);

      const startTime = Date.now();
      await ethers.provider.send("evm_mine", [startTime]);

      const totalSupplyBefore = await token.totalSupply();

      // Transfer 100 tokens from owner to addr2.
      const addr2Transfer = ethers.utils.parseEther("1.0");
      await token.transfer(addr2.address, addr2Transfer, { from: owner.address });

      const nextTime = startTime + 60 * 1000; // 1min
      await ethers.provider.send("evm_mine", [nextTime]);

      const totalSupplyAfter = await token.totalSupply();

      expect(totalSupplyAfter).to.be.lessThan(totalSupplyBefore);
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

    it("Disallows burning when paused and allows when unpaused", async () => {
      const { token, owner, addr2 } = await loadFixture(loadContract);

      await token.transfer(addr2.address, 10000);

      await token.connect(addr2).pause();

      await expect(token.connect(addr2).burnFrom(owner.address, 50000)).to.be.revertedWith(
        "Pausable: paused"
      );

      await token.connect(addr2).unpause();

      const ownerTokenBalance = await token.balanceOf(owner.address);
      await token.connect(addr2).burnFrom(owner.address, 50000);

      expect(await token.balanceOf(owner.address)).to.lessThan(ownerTokenBalance);
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
  });
});
