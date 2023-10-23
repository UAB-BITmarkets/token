import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { loadContracts, cliff, vestingDuration } from "./fixture";

import { BITMarketsTokenAllocations__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenAllocations__factory";

describe("Deployment", () => {
  it("Should assign a percentage of the total supply of the token to the allocations contract and all initial stuff should be ok", async () => {
    const { token, allocations, allocationsWallet, allocationsAdminWallet } =
      await loadFixture(loadContracts);

    const totalSupply = await token.totalSupply();
    const allocationsSupply = totalSupply / BigInt(3); // 1/5th of total supply
    expect(await allocations.token()).to.equal(await token.getAddress());
    expect(await allocations.wallet()).to.equal(allocationsWallet.address);
    expect(await allocations.admin()).to.equal(allocationsAdminWallet.address);
    expect(await token.allowance(allocationsWallet.address, allocations.getAddress())).to.equal(
      allocationsSupply
    );
  });

  it("Should not be possible to deploy with zero token address", async () => {
    const { companyLiquidityWallet, allocationsWallet, allocationsAdminWallet } =
      await loadFixture(loadContracts);

    const BITMarketsTokenAllocationsFactory = new BITMarketsTokenAllocations__factory(
      companyLiquidityWallet
    );
    await expect(
      BITMarketsTokenAllocationsFactory.deploy(
        allocationsWallet.address,
        allocationsAdminWallet.address,
        ethers.ZeroAddress,
        cliff,
        vestingDuration
      )
    ).to.revertedWith("Token 0 address");
  });

  it("Should not be possible to deploy with zero token wallet address", async () => {
    const { token, companyLiquidityWallet, allocationsAdminWallet } =
      await loadFixture(loadContracts);

    const BITMarketsTokenAllocationsFactory = new BITMarketsTokenAllocations__factory(
      companyLiquidityWallet
    );
    await expect(
      BITMarketsTokenAllocationsFactory.deploy(
        ethers.ZeroAddress,
        allocationsAdminWallet.address,
        token.getAddress(),
        cliff,
        vestingDuration
      )
    ).to.revertedWith("Token wallet 0 address");
  });

  it("Should not be possible to deploy with zero admin wallet address", async () => {
    const { token, companyLiquidityWallet, allocationsWallet } = await loadFixture(loadContracts);

    const BITMarketsTokenAllocationsFactory = new BITMarketsTokenAllocations__factory(
      companyLiquidityWallet
    );
    await expect(
      BITMarketsTokenAllocationsFactory.deploy(
        allocationsWallet.address,
        ethers.ZeroAddress,
        token.getAddress(),
        cliff,
        vestingDuration
      )
    ).to.revertedWith("Admin wallet 0 address");
  });
});
