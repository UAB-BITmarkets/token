import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const teamWalletsLen = 1070;

writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "teamAllocationsWallets.csv"),
  `PRIVATE_KEY,ADDRESS,AMOUNT`
);

for (let i = 0; i < teamWalletsLen; i++) {
  const file = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "teamAllocationsWallets.csv"),
    "utf8"
  );

  const wallet = ethers.Wallet.createRandom();

  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "teamAllocationsWallets.csv"),
    `${file}\n${wallet.privateKey},${wallet.address},${
      i < 10 ? 1000000 : i < 20 ? 500000 : i < 70 ? 100000 : 10000
    }`
  );
}

const salesWalletsLen = 565;

writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "salesAllocationsWallets.csv"),
  `PRIVATE_KEY,ADDRESS,AMOUNT`
);

for (let i = 0; i < salesWalletsLen; i++) {
  const file = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "salesAllocationsWallets.csv"),
    "utf8"
  );

  const wallet = ethers.Wallet.createRandom();

  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "salesAllocationsWallets.csv"),
    `${file}\n${wallet.privateKey},${wallet.address},${
      i < 5 ? 1000000 : i < 15 ? 500000 : i < 65 ? 100000 : 10000
    }`
  );
}
