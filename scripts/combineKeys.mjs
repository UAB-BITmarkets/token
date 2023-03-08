import dcrypto from "@deliberative/crypto";
import { ethers } from "ethers";

const shares = [
  Uint8Array.from(
    Buffer.from(
      // put share here
      "2370799d625d88247ae90c611aeb685f08076a25b5eecb96b095c3a02ff49e1001",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "8a3a442a8481fa80b1ddb1a84468c3980213761f265775f6b0ba22afb3ff5e5305",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "87af829506893600778ebc0f577875924aaac36a0ab9dc7fd35b9c894f2099bd06",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "0a7518c80562ded97fd8ddf0d6b0d84b24013c7118b0df5d6c049bba7574580708",
      "hex"
    )
  ),
  Uint8Array.from(
    Buffer.from(
      // put share here
      "ec5c5490387d10816fe18f08df31e4a94367222c0038e24818e2c01e12a184ce09",
      "hex"
    )
  )
];

(async () => {
  const combined = await dcrypto.restoreSecret(shares);
  const combinedWithoutOx = Buffer.from(combined).toString("hex");
  const combinedPrivateKey = "0x" + combinedWithoutOx;
  const wallet = new ethers.Wallet(combinedPrivateKey);

  console.log(wallet.address);
})();
