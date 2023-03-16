import dcrypto from "@deliberative/crypto";
import { ethers } from "ethers";

const shares = [
  Uint8Array.from(
    Buffer.from(
      // put share here
      "",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "",
      "hex"
    )
  )
];

(async () => {
  const combined = await dcrypto.restoreSecret(shares);
  const combinedWithoutOx = Buffer.from(combined).toString("hex");
  const combinedPrivateKey = "0x" + combinedWithoutOx;
  const wallet = new ethers.Wallet(combinedPrivateKey);

  console.log(wallet.privateKey);
  console.log(wallet.address);
})();
