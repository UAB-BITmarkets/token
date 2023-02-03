import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { BITMarketsToken } from "../typechain-types/contracts/BITMarketsToken";
import type { BITMarketsTokenWhitelistedVestingCrowdsale } from "../typechain-types/contracts/BITMarketsTokenWhitelistedVestingCrowdsale";
import type { BITMarketsTokenICOVestingCrowdsale } from "../typechain-types/contracts/BITMarketsTokenICOVestingCrowdsale";

type Fixture<T> = () => Promise<T>;

export interface Signers {
  admin: SignerWithAddress;
}

declare module "mocha" {
  export interface Context {
    token: BITMarketsToken;
    whitelisted: BITMarketsTokenWhitelistedVestingCrowdsale;
    ico: BITMarketsTokenICOVestingCrowdsale;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
