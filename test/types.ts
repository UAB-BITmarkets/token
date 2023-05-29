import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { BITMarketsToken } from "../typechain-types/contracts/BITMarketsToken";
import type { BITMarketsTokenPrivateSale } from "../typechain-types/contracts/BITMarketsTokenPrivateSale";
import type { BITMarketsTokenPublicSale } from "../typechain-types/contracts/BITMarketsTokenPublicSale";

type Fixture<T> = () => Promise<T>;

export interface Signers {
  admin: SignerWithAddress;
}

declare module "mocha" {
  export interface Context {
    token: BITMarketsToken;
    whitelisted: BITMarketsTokenPrivateSale;
    ico: BITMarketsTokenPublicSale;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}
