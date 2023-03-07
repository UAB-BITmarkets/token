import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { loadContracts, cliff, vestingDuration } from "./fixture";

import type { BITMarketsTokenAllocations__factory } from "../../typechain-types/factories/contracts/BITMarketsTokenAllocations__factory";

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
    const { companyLiquidityWallet, allocationsWallet, allocationsAdminWallet } = await loadFixture(
      loadContracts
    );

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
