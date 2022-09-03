import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { Greeter } from "../typechain-types/contracts/Greeter";
import type { BITMarketsToken } from "../typechain-types/contracts/BITMarketsToken";
import type { BITMarketsTokenCrowdsale } from "../typechain-types/contracts/BITMarketsTokenCrowdsale";

type Fixture<T> = () => Promise<T>;

export interface Signers {
  admin: SignerWithAddress;
}

declare module "mocha" {
  export interface Context {
    greeter: Greeter;
    token: BITMarketsToken;
    ico: BITMarketsTokenCrowdsale;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
