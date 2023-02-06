import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dcrypto from "@deliberative/crypto";
import { ethers } from "ethers";

const companyLiquidityWallet = ethers.Wallet.createRandom();
const allocationsWallet = ethers.Wallet.createRandom();
const crowdsalesWallet = ethers.Wallet.createRandom();

const companyRewardsWallet = ethers.Wallet.createRandom();
const esgFundWallet = ethers.Wallet.createRandom();

const minterWallet = ethers.Wallet.createRandom();
const pauserWallet = ethers.Wallet.createRandom();
const whitelisterWallet = ethers.Wallet.createRandom();
const blacklisterWallet = ethers.Wallet.createRandom();
const feelessAdminWallet = ethers.Wallet.createRandom();
const companyRestrictionWhitelistWallet = ethers.Wallet.createRandom();

const allocationsAdminWallet = ethers.Wallet.createRandom();
const crowdsalesClientPurchaserWallet = ethers.Wallet.createRandom();

const split = async (wallet, totalShares, threshold, filename, nameOfPrivateKey) => {
  const pk = wallet.privateKey;
  const pkWithoutOx = pk.substring(2);
  const pkUint8 = Uint8Array.from(Buffer.from(pkWithoutOx, "hex"));

  const shares = await dcrypto.splitSecret(pkUint8, totalShares, threshold);

  const reducedShares = [...shares];

  reducedShares.pop();
  reducedShares.pop();
  reducedShares.pop();
  reducedShares.pop();

  const recreatedUint8 = await dcrypto.restoreSecret(reducedShares);
  const recreatedCpkWithoutOx = Buffer.from(recreatedUint8).toString("hex");
  const recreatedCpk = "0x" + recreatedCpkWithoutOx;

  if (pk === recreatedCpk) {
    let data = "";
    for (let i = 0; i < shares.length; i++) {
      data += Buffer.from(shares[i]).toString("hex");
      data += "\n";
    }

    writeFileSync(
      filename,
      `\
${data}\n\
These are the validated Shamir shares for the ${nameOfPrivateKey} private key.\n\
They are ${totalShares} total.\n\
You need at least ${threshold} to recreate the secret.\n\
The address of this wallet is ${companyLiquidityWallet.address} .\
`
    );
  }
};

(async () => {
  const wallet = companyLiquidityWallet;
  const totalShares = 9;
  const threshold = 5;
  const filename = join(
    dirname(fileURLToPath(import.meta.url)),
    "company_liquidity_shamir_shares.txt"
  );
  const nameOfPrivateKey = "company liquidity wallet";
  await split(wallet, totalShares, threshold, filename, nameOfPrivateKey);
})();

(async () => {
  const wallet = companyRewardsWallet;
  const totalShares = 9;
  const threshold = 5;
  const filename = join(
    dirname(fileURLToPath(import.meta.url)),
    "company_rewards_shamir_shares.txt"
  );
  const nameOfPrivateKey = "company rewards wallet";
  await split(wallet, totalShares, threshold, filename, nameOfPrivateKey);
})();

(async () => {
  const wallet = esgFundWallet;
  const totalShares = 9;
  const threshold = 5;
  const filename = join(dirname(fileURLToPath(import.meta.url)), "esg_fund_shamir_shares.txt");
  const nameOfPrivateKey = "esg fund wallet";
  await split(wallet, totalShares, threshold, filename, nameOfPrivateKey);
})();

writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), ".env"),
  `\
COMPANY_LIQUIDITY_WALLET_PRIVATE_KEY=${companyLiquidityWallet.privateKey}\n\
COMPANY_LIQUIDITY_WALLET_ADDRESS=${companyLiquidityWallet.address}\n\
# Will only have tokens until it allocates the tokens to their respective wallets\n\
# It is a strategic wallet so it cannot move unlimited amounts of tokens\n\
ALLOCATIONS_WALLET_PRIVATE_KEY=${allocationsWallet.privateKey}\n\
# Same case as the above but this serves tokens to the smart contracts\n\
# of the crowdsales\n\
CROWDSALES_WALLET_PRIVATE_KEY=${crowdsalesWallet.privateKey}\n\
COMPANY_REWARDS_WALLET_PRIVATE_KEY=${companyRewardsWallet.privateKey}\n\
COMPANY_REWARDS_WALLET_ADDRESS=${companyRewardsWallet.address}\n\
ESG_FUND_WALLET_PRIVATE_KEY=${esgFundWallet.privateKey}\n\
ESG_FUND_WALLET_ADDRESS=${esgFundWallet.address}\n\
MINTER_WALLET_PRIVATE_KEY=${minterWallet.privateKey}\n\
PAUSER_WALLET_PRIVATE_KEY=${pauserWallet.privateKey}\n\
WHITELISTER_WALLET_PRIVATE_KEY=${whitelisterWallet.privateKey}\n\
BLACKLISTER_WALLET_PRIVATE_KEY=${blacklisterWallet.privateKey}\n\
# This wallet can add feeless addresses and feeless admins such as\n\
# smart contracts generating vesting wallets\n\
FEELESS_ADMIN_WALLET_PRIVATE_KEY=${feelessAdminWallet.privateKey}\n\
# This wallet can lift the company liquidity restriction for one transfer only.\n\
# To be handled exclusively by the CEO\n\
COMPANY_RESTRICTION_WHITELIST_WALLET_PRIVATE_KEY=${companyRestrictionWhitelistWallet.privateKey}\n\
# This wallet can call the "allocate" function\n\
ALLOCATIONS_ADMIN_WALLET_PRIVATE_KEY=${allocationsAdminWallet.privateKey}\n\
# This wallet has funds to participate to the crowdsales\n\
# on behalf of addresses\n\
CROWDSALES_CLIENT_PURCHASER_WALLET_PRIVATE_KEY=${crowdsalesClientPurchaserWallet.privateKey}\n\
\n# Send some funds to the wallet with address ${companyLiquidityWallet.address} to have enough to deploy.`
);
