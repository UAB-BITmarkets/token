import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ethers } from "hardhat";

import { shouldBehaveLikeGreeter } from "./Greeter.behavior";

import type { Signers } from "../types";

import type { Greeter } from "../../typechain-types/contracts/Greeter";
import type { Greeter__factory } from "../../typechain-types/factories/contracts/Greeter__factory";

describe("Greeter unit tests", function () {
  async function deployGreeterFixture(): Promise<{ greeter: Greeter }> {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin: SignerWithAddress = signers[0];

    const greeting: string = "Hello, world!";
    const greeterFactory: Greeter__factory = <Greeter__factory>(
      await ethers.getContractFactory("Greeter")
    );
    const greeter: Greeter = <Greeter>await greeterFactory.connect(admin).deploy(greeting);
    await greeter.deployed();

    return { greeter };
  }

  before(async function () {
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers.admin = signers[0];

    this.loadFixture = loadFixture;
  });

  describe("Greeter", function () {
    beforeEach(async function () {
      const { greeter } = await this.loadFixture(deployGreeterFixture);
      this.greeter = greeter;
    });

    shouldBehaveLikeGreeter();
  });
});
