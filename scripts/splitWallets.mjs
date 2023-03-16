import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dcrypto from "@deliberative/crypto";
import { ethers } from "ethers";

const WALLET_PRIVATE_KEY = "";
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY);

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
The address of this wallet is ${wallet.address} .\
`
    );
  }
};

(async () => {
  const totalShares = 9;
  const threshold = 5;
  const filename = join(
    dirname(fileURLToPath(import.meta.url)),
    "allocations_wallet_shamir_shares.txt"
  );
  const nameOfPrivateKey = "allocations wallet";
  await split(wallet, totalShares, threshold, filename, nameOfPrivateKey);
})();
