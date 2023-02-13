import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import type { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import type { BITMarketsTokenAllocations__factory } from "../typechain-types/factories/contracts/BITMarketsTokenAllocations__factory";

import type { Wallet } from "ethers";

const cliff = 10; // seconds locked
const vestingDuration = 20; // seconds after cliff for full vesting

const initialSupply = 300000000;
const finalSupply = 200000000;

const companyWalletTokens = initialSupply / 3;
const allocationsWalletTokens = initialSupply / 3;
const crowdsalesWalletTokens = initialSupply / 3;

const maxCompanyWalletTransfer = companyWalletTokens / 20;

const companyRate = 1;
const esgFundRate = 1;
const burnRate = 1; // 1/1000 = 0.1%

const salesWalletsLen = 10;
const salesWallets: Wallet[] = [];
for (let i = 0; i < salesWalletsLen; i++) {
  salesWallets.push(ethers.Wallet.createRandom());
}
const salesAllocationPerWallet = (allocationsWalletTokens * 40) / 100 / salesWalletsLen;

const marketingWallet = ethers.Wallet.createRandom();
const marketingAllocation = (allocationsWalletTokens * 25) / 100;

const teamWalletsLen = 3;
const teamWallets: Wallet[] = [];
for (let i = 0; i < teamWalletsLen; i++) {
  teamWallets.push(ethers.Wallet.createRandom());
}
const teamAllocationPerWallet = (allocationsWalletTokens * 30) / 100 / teamWalletsLen;

const airdropsWalletsLen = 10;
const airdropsWallets: Wallet[] = [];
for (let i = 0; i < airdropsWalletsLen; i++) {
  airdropsWallets.push(ethers.Wallet.createRandom());
}
const airdropsAllocationPerWallet = (allocationsWalletTokens * 5) / 100 / airdropsWalletsLen;

describe("BITMarkets ERC20 token allocations tests", () => {
  const loadContracts = async () => {
    const [
      companyLiquidityWallet,
      addr1,
      addr2,
      allocationsWallet,
      crowdsalesWallet,
      companyRewardsWallet,
      esgFundWallet,
      minterWallet,
      pauserWallet,
      whitelisterWallet,
      blacklisterWallet,
      feelessAdminWallet,
      companyRestrictionWhitelistWallet,
      allocationsAdminWallet,
      crowdsalesClientPurchaserWallet
    ] = await ethers.getSigners();

    const BITMarketsTokenFactory = (await ethers.getContractFactory(
      "BITMarketsToken",
      companyLiquidityWallet
    )) as BITMarketsToken__factory;

    const token = await BITMarketsTokenFactory.deploy({
      initialSupply,
      finalSupply,
      allocationsWalletTokens,
      crowdsalesWalletTokens,
      maxCompanyWalletTransfer,
      companyRate,
      esgFundRate,
      burnRate,
      allocationsWallet: allocationsWallet.address,
      crowdsalesWallet: crowdsalesWallet.address,
      companyRewardsWallet: companyRewardsWallet.address,
      esgFundWallet: esgFundWallet.address,
      minterWallet: minterWallet.address,
      pauserWallet: pauserWallet.address,
      blacklisterWallet: blacklisterWallet.address,
      feelessAdminWallet: feelessAdminWallet.address,
      companyRestrictionWhitelistWallet: companyRestrictionWhitelistWallet.address
    });
    await token.deployed();

    const totalSupply = await token.totalSupply();
    const cap = totalSupply.div(3);

    const BITMarketsTokenAllocationsFactory = (await ethers.getContractFactory(
      "BITMarketsTokenAllocations",
      companyLiquidityWallet
    )) as BITMarketsTokenAllocations__factory;
    const allocations = await BITMarketsTokenAllocationsFactory.deploy(
      allocationsWallet.address,
      allocationsAdminWallet.address,
      token.address,
      cliff,
      vestingDuration
    );
    await allocations.deployed();

    await token.connect(feelessAdminWallet).addFeeless(allocations.address);
    await token.connect(feelessAdminWallet).addFeeless(allocationsWallet.address);
    await token
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        companyLiquidityWallet.address,
        allocationsWallet.address,
        ethers.utils.parseEther(`${allocationsWalletTokens}`)
      );
    await token.transfer(
      allocationsWallet.address,
      ethers.utils.parseEther(`${allocationsWalletTokens}`)
    );
    await token
      .connect(companyRestrictionWhitelistWallet)
      .addUnrestrictedReceiver(
        allocationsWallet.address,
        allocations.address,
        ethers.utils.parseEther(`${allocationsWalletTokens}`)
      );
    await token.connect(feelessAdminWallet).addFeelessAdmin(allocations.address);

    await token.connect(allocationsWallet).approve(allocations.address, cap);
    // await token.transfer(crowdsale.address, cap);
    // await token.increaseAllowance(crowdsale.address, cap);

    return {
      token,
      allocations,
      companyLiquidityWallet,
      addr1,
      addr2,
      allocationsWallet,
      crowdsalesWallet,
      companyRewardsWallet,
      esgFundWallet,
      minterWallet,
      pauserWallet,
      whitelisterWallet,
      blacklisterWallet,
      feelessAdminWallet,
      companyRestrictionWhitelistWallet,
      allocationsAdminWallet,
      crowdsalesClientPurchaserWallet
    };
  };

  describe("Deployment", () => {
    it("Should assign a percentage of the total supply of the token to the allocations contract and all initial stuff should be ok", async () => {
      const { token, allocations, allocationsWallet, allocationsAdminWallet } = await loadFixture(
        loadContracts
      );

      const totalSupply = await token.totalSupply();
      const allocationsSupply = totalSupply.div(3); // 1/5th of total supply
      expect(await allocations.token()).to.equal(token.address);
      expect(await allocations.wallet()).to.equal(allocationsWallet.address);
      expect(await allocations.admin()).to.equal(allocationsAdminWallet.address);
      expect(await token.allowance(allocationsWallet.address, allocations.address)).to.equal(
        allocationsSupply
      );
    });

    it("Should not be possible to deploy with zero token address", async () => {
      const { companyLiquidityWallet, allocationsWallet, allocationsAdminWallet } =
        await loadFixture(loadContracts);

      const BITMarketsTokenAllocationsFactory = (await ethers.getContractFactory(
        "BITMarketsTokenAllocations",
        companyLiquidityWallet
      )) as BITMarketsTokenAllocations__factory;
      await expect(
        BITMarketsTokenAllocationsFactory.deploy(
          allocationsWallet.address,
          allocationsAdminWallet.address,
          ethers.constants.AddressZero,
          cliff,
          vestingDuration
        )
      ).to.revertedWith("Token 0 address");
    });

    it("Should not be possible to deploy with zero token wallet address", async () => {
      const { token, companyLiquidityWallet, allocationsAdminWallet } = await loadFixture(
        loadContracts
      );

      const BITMarketsTokenAllocationsFactory = (await ethers.getContractFactory(
        "BITMarketsTokenAllocations",
        companyLiquidityWallet
      )) as BITMarketsTokenAllocations__factory;
      await expect(
        BITMarketsTokenAllocationsFactory.deploy(
          ethers.constants.AddressZero,
          allocationsAdminWallet.address,
          token.address,
          cliff,
          vestingDuration
        )
      ).to.revertedWith("Token wallet 0 address");
    });

    it("Should not be possible to deploy with zero admin wallet address", async () => {
      const { token, companyLiquidityWallet, allocationsWallet } = await loadFixture(loadContracts);

      const BITMarketsTokenAllocationsFactory = (await ethers.getContractFactory(
        "BITMarketsTokenAllocations",
        companyLiquidityWallet
      )) as BITMarketsTokenAllocations__factory;
      await expect(
        BITMarketsTokenAllocationsFactory.deploy(
          allocationsWallet.address,
          ethers.constants.AddressZero,
          token.address,
          cliff,
          vestingDuration
        )
      ).to.revertedWith("Admin wallet 0 address");
    });
  });

  describe("Allocation", () => {
    it("Should be possible to allocate", async () => {
      const { token, allocations, addr1, allocationsAdminWallet } = await loadFixture(
        loadContracts
      );

      const amount = ethers.utils.parseEther("1.0");

      await allocations.connect(allocationsAdminWallet).allocate(addr1.address, amount);

      const vestingWalletAddress = await allocations.vestingWallet(addr1.address);

      expect(await token.balanceOf(vestingWalletAddress)).to.be.equal(amount);
    });

    it("Vesting and withdrawals should work as expected", async () => {
      const { token, allocations, addr1, allocationsAdminWallet } = await loadFixture(
        loadContracts
      );

      const openingTime = Date.now();
      await ethers.provider.send("evm_mine", [openingTime]);

      const amount = ethers.utils.parseEther("100.0");

      await allocations.connect(allocationsAdminWallet).allocate(addr1.address, amount);

      expect(await token.balanceOf(addr1.address)).to.be.equal(ethers.utils.parseEther("0"));

      expect(await allocations.vestedAmount(addr1.address)).to.be.equal(
        ethers.utils.parseEther("0")
      );

      await ethers.provider.send("evm_mine", [openingTime + cliff + vestingDuration / 2]);

      expect(await allocations.vestedAmount(addr1.address)).to.be.equal(
        ethers.utils.parseEther("45")
      );

      await allocations.connect(addr1).withdraw(addr1.address);

      expect(await token.balanceOf(addr1.address)).to.be.equal(ethers.utils.parseEther("50"));

      await ethers.provider.send("evm_mine", [openingTime + cliff + vestingDuration]);

      await allocations.connect(addr1).withdraw(addr1.address);

      expect(await token.balanceOf(addr1.address)).to.be.equal(amount);
    });

    it("Should not be possible for a non-allocation admin to allocate.", async () => {
      const { allocations, addr1 } = await loadFixture(loadContracts);

      const amount = ethers.utils.parseEther("1.0");

      await expect(allocations.connect(addr1).allocate(addr1.address, amount)).to.be.revertedWith(
        "Invalid message sender"
      );
    });

    it("Should not be possible for an already allocated wallet to reallocate.", async () => {
      const { allocations, addr1, allocationsAdminWallet } = await loadFixture(loadContracts);

      const amount = ethers.utils.parseEther("1.0");

      await allocations.connect(allocationsAdminWallet).allocate(addr1.address, amount);

      await expect(
        allocations.connect(allocationsAdminWallet).allocate(addr1.address, amount)
      ).to.be.revertedWith("Vesting wallet exists");
    });

    it("Should not be possible to allocate more than the max amount.", async () => {
      const { allocations, addr1, allocationsAdminWallet } = await loadFixture(loadContracts);

      const amount = ethers.utils.parseEther(`${allocationsWalletTokens + 1}`);

      await expect(
        allocations.connect(allocationsAdminWallet).allocate(addr1.address, amount)
      ).to.be.revertedWith("Amount too large");
    });

    it("Should not be possible to withdraw if not beneficiary.", async () => {
      const { allocations, addr1, allocationsAdminWallet } = await loadFixture(loadContracts);

      const amount = ethers.utils.parseEther(`${allocationsWalletTokens}`);

      await expect(allocations.connect(addr1).withdraw(addr1.address)).to.revertedWith(
        "No vesting wallet"
      );

      await allocations.connect(allocationsAdminWallet).allocate(addr1.address, amount);

      // await expect(allocations.connect(addr2).withdraw(addr1.address)).to.revertedWith(
      //   "Invalid msg sender"
      // );
    });

    it("Should not be possible to get vesting wallet address if not on the list", async () => {
      const { allocations, addr1 } = await loadFixture(loadContracts);

      await expect(allocations.connect(addr1).vestingWallet(addr1.address)).to.revertedWith(
        "No vesting wallet"
      );
    });

    it("Should not be possible to get vested amount if not on the list", async () => {
      const { allocations, addr1 } = await loadFixture(loadContracts);

      await expect(allocations.connect(addr1).vestedAmount(addr1.address)).to.revertedWith(
        "No vesting wallet"
      );
    });

    it("Should be possible for BITMarkets allocations to happen", async () => {
      const { token, allocations, allocationsWallet, allocationsAdminWallet } = await loadFixture(
        loadContracts
      );

      expect(
        teamWalletsLen * teamAllocationPerWallet +
          marketingAllocation +
          airdropsWalletsLen * airdropsAllocationPerWallet +
          salesWalletsLen * salesAllocationPerWallet
      ).to.be.equal(allocationsWalletTokens);

      let i = 0;

      const salesAllocationPerWalletDecimals = ethers.utils.parseEther(
        `${salesAllocationPerWallet}`
      );
      for (i = 0; i < salesWalletsLen; i++) {
        await allocations
          .connect(allocationsAdminWallet)
          .allocate(salesWallets[i].address, salesAllocationPerWalletDecimals);
      }

      const teamAllocationPerWalletDecimals = ethers.utils.parseEther(`${teamAllocationPerWallet}`);
      for (i = 0; i < teamWalletsLen; i++) {
        await allocations
          .connect(allocationsAdminWallet)
          .allocate(teamWallets[i].address, teamAllocationPerWalletDecimals);
      }

      const marketingAllocationDecimals = ethers.utils.parseEther(`${marketingAllocation}`);
      await allocations
        .connect(allocationsAdminWallet)
        .allocate(marketingWallet.address, marketingAllocationDecimals);

      const airdropsAllocationDecimals = ethers.utils.parseEther(`${airdropsAllocationPerWallet}`);
      for (i = 0; i < airdropsWalletsLen; i++) {
        await allocations
          .connect(allocationsAdminWallet)
          .allocate(airdropsWallets[i].address, airdropsAllocationDecimals);
      }

      let allocationsWalletTokensVesting = ethers.utils.parseEther("0");

      expect(await token.balanceOf(allocationsWallet.address)).to.be.equal(
        allocationsWalletTokensVesting
      );

      for (i = 0; i < salesWalletsLen; i++) {
        const vestingWallet = await allocations.vestingWallet(salesWallets[i].address);

        const balance = await token.balanceOf(vestingWallet);

        allocationsWalletTokensVesting = allocationsWalletTokensVesting.add(balance);
      }

      for (i = 0; i < teamWalletsLen; i++) {
        const vestingWallet = await allocations.vestingWallet(teamWallets[i].address);

        const balance = await token.balanceOf(vestingWallet);

        allocationsWalletTokensVesting = allocationsWalletTokensVesting.add(balance);
      }

      const marketingVestingWallet = await allocations.vestingWallet(marketingWallet.address);

      const marketingVestingBalance = await token.balanceOf(marketingVestingWallet);

      allocationsWalletTokensVesting = allocationsWalletTokensVesting.add(marketingVestingBalance);

      for (i = 0; i < airdropsWalletsLen; i++) {
        const vestingWallet = await allocations.vestingWallet(airdropsWallets[i].address);

        const balance = await token.balanceOf(vestingWallet);

        allocationsWalletTokensVesting = allocationsWalletTokensVesting.add(balance);
      }

      expect(allocationsWalletTokensVesting).to.be.equal(
        ethers.utils.parseEther(`${allocationsWalletTokens}`)
      );

      // expect(await crowdsale.remainingTokens()).to.lessThan(
      //   companyLiquidityWalletCurrentTokenBalance
      // );
      // expect(addr2TokenBalanceWhenLocked).to.equal(0);
      // expect(addr2VestedAmountBeforeCliff).to.lessThan(addr2RemainingTokensBeforeCliff);
      // expect(addr2VestedAmountBeforeCliff).to.equal(0);
      // expect(addr2TokenBalanceAfterCliffBeforeCompleteVestingNoWithdraw).to.equal(0);
      // expect(addr2TokenBalanceWhenLocked).to.lessThan(
      //   addr2TokenBalanceAfterCliffBeforeCompleteVesting
      // );
      // expect(addr2TokenBalanceAfterCliffBeforeCompleteVesting).to.lessThan(
      //   addr2TokenBalanceAfterCliffCompleteVesting
      // );
      // expect(companyLiquidityWalletInitialTokenBalance.sub(companyLiquidityWalletCurrentTokenBalance)).to.equal(addr2TokenBalance);
    });
  });
});
