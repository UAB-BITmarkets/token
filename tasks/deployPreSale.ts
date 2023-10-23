import { ethers } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { BITMarketsToken__factory } from "../typechain-types/factories/contracts/BITMarketsToken__factory";
import { BITMarketsTokenPrivateSale__factory } from "../typechain-types/factories/contracts/BITMarketsTokenPrivateSale__factory";

import getGasData from "../utils/getGasData";

const preSaleOpeningTime =
  process.env.NODE_ENV === "production"
    ? // ? Math.trunc(new Date(`2023-09-01T09:00:00`).valueOf() / 1000)
      Math.trunc((Date.now() + 10 * 60 * 1000) / 1000) //  10 minutes
    : Math.trunc((Date.now() + 2 * 60 * 1000) / 1000); // 2 minutes
const preSaleClosingTime =
  process.env.NODE_ENV === "production"
    ? // Math.trunc(new Date("2023-12-23T17:00:00").valueOf() / 1000)
      Math.trunc((Date.now() + 4 * 30 * 24 * 60 * 60 * 1000) / 1000) // 4 months
    : Math.trunc((Date.now() + 4 * 30 * 24 * 60 * 60 * 1000) / 1000); // 1 day

const investorTariff = ethers.parseEther("500.0"); // 500 matic
const investorCap = ethers.parseEther("50000.0"); // 50000 matic

const cliff =
  process.env.NODE_ENV === "production"
    ? 6 * 30 * 24 * 60 * 60 // 3 months after purchase
    : 3 * 60; // 3 minutes after purchase = 3 * 60 seconds locked
const vestingDuration =
  process.env.NODE_ENV === "production"
    ? 100 * 24 * 60 * 60 // 100 days linear after cliff = 100 days * 24 hours * 60 minutes * 60 seconds
    : 100 * 60; // 100 minutes linear after cliff

const rate = 12; // 1 MATIC = 12 BTMT

const provider =
  process.env.NODE_ENV === "development"
    ? new ethers.JsonRpcProvider("HTTP://127.0.0.1:8545")
    : process.env.NODE_ENV === "testing"
    ? new ethers.AlchemyProvider("maticmum", process.env.ALCHEMY_API_KEY || "")
    : new ethers.AlchemyProvider("matic", process.env.ALCHEMY_API_KEY || "");

const btmt = BITMarketsToken__factory.connect(
  process.env.NODE_ENV === "production"
    ? "0x0fCed30234C3ea94A7B47cC88006ECb7A39Dc30E"
    : "0x247f8786C70A8CDE1df4EDDB6dE16CB926dcc408",
  provider
);

// const PRIVATE_SALE = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
const privateSale = BITMarketsTokenPrivateSale__factory.connect(
  process.env.NODE_ENV === "production"
    ? "0xCda8fB1225be662574f7b3FDd7e79EB883207B98"
    : "0x5e255de70b2F825041442035eC8330FbbED96145",
  provider
);

task("deployPreSale", "Deploy presale contract and stop private sale").setAction(
  async (_, hre: HardhatRuntimeEnvironment): Promise<void> => {
    const [
      companyLiquidityWallet, // needed
      allocationsWallet, // needed
      crowdsalesWallet, // needed
      companyRewardsWallet,
      esgFundWallet,
      whitelisterWallet,
      feelessAdminWallet, // needed
      companyRestrictionWhitelistWallet, // needed
      allocationsAdminWallet, // needed
      crowdsalesClientPurchaserWallet
    ] = await hre.ethers.getSigners();

    let maxFeePerGas = ethers.parseEther("0");
    let maxPriorityFeePerGas = ethers.parseEther("0");

    const fees = await getGasData();
    maxFeePerGas = fees.maxFeePerGas;
    maxPriorityFeePerGas = fees.maxPriorityFeePerGas;

    const tx1 = await btmt
      .connect(companyRestrictionWhitelistWallet)
      .removeUnrestrictedReceiver(crowdsalesWallet.address, {
        maxFeePerGas,
        maxPriorityFeePerGas
      });
    console.log(
      `1) Remove private sale contract from unrestricted receiver of crowdsales wallet transaction hash ${tx1.hash} with nonce ${tx1.nonce}`
    );
    await tx1.wait();

    const allowance = await btmt
      .connect(crowdsalesWallet)
      .allowance(crowdsalesWallet.address, await privateSale.getAddress());
    const tx2 = await btmt
      .connect(crowdsalesWallet)
      .decreaseAllowance(await privateSale.getAddress(), allowance);
    console.log(
      `2) Remove sales wallet allowance from private sale contract transaction hash ${tx2.hash} with nonce ${tx2.nonce}`
    );
    await tx2.wait();

    await new Promise((resolve) => setTimeout(resolve, 2 + Math.random() * 1000));

    const fees1 = await getGasData();
    maxFeePerGas = fees1.maxFeePerGas;
    maxPriorityFeePerGas = fees1.maxPriorityFeePerGas;

    // const PRESALE = await hre.ethers.getContractFactory("BITMarketsTokenPrivateSale");
    const PRESALE = new BITMarketsTokenPrivateSale__factory(companyLiquidityWallet);
    const preSale = await PRESALE.deploy(
      {
        rate,
        wallet: crowdsalesWallet.address,
        purchaser: crowdsalesClientPurchaserWallet.address,
        token: await btmt.getAddress(),
        whitelister: whitelisterWallet.address,
        openingTime: preSaleOpeningTime,
        closingTime: preSaleClosingTime,
        investorTariff,
        investorCap,
        cliff,
        vestingDuration
      },
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    const preSaleDeployTransaction = preSale.deploymentTransaction();
    console.log(
      `3) Pre sale deployment transaction hash ${preSaleDeployTransaction?.hash} with nonce ${preSaleDeployTransaction?.nonce}`
    );
    await preSale.waitForDeployment();
    // await preSale.deployed();
    // const preSale = PUBLIC_SALE.connect(companyLiquidityWallet).attach(
    //   "0xF115c943117D326aa40a9632F430029E3FE14A7E"
    // );
    console.log(`PRESALE_CONTRACT_ADDRESS=${preSale.getAddress()}`);

    const fees2 = await getGasData();
    maxFeePerGas = fees2.maxFeePerGas;
    maxPriorityFeePerGas = fees2.maxPriorityFeePerGas;

    const tx3 = await btmt.connect(feelessAdminWallet).addFeeless(await preSale.getAddress(), {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `4) Make presale contract feeless transaction hash ${tx3.hash} with nonce ${tx3.nonce}`
    );
    await tx3.wait();

    const crowdsalesWalletBalance = await btmt
      .connect(companyLiquidityWallet)
      .balanceOf(crowdsalesWallet.address);
    const publicSaleCap = ethers.parseEther("60000000");
    const preSaleCap = crowdsalesWalletBalance - publicSaleCap;
    console.log(`Presale cap is ${ethers.formatEther(preSaleCap)} BTMT`);

    const tx4 = await btmt.connect(companyRestrictionWhitelistWallet).addUnrestrictedReceiver(
      crowdsalesWallet.address,
      preSale.getAddress(),
      preSaleCap, // ethers.utils.parseEther(`${preSaleCap}`),
      {
        maxFeePerGas,
        maxPriorityFeePerGas
      }
    );
    console.log(
      `5) Make presale contract an unrestricted receiver for crowdsales wallet transaction hash ${tx4.hash} with nonce ${tx4.nonce}`
    );
    await tx4.wait();

    const fees3 = await getGasData();
    maxFeePerGas = fees3.maxFeePerGas;
    maxPriorityFeePerGas = fees3.maxPriorityFeePerGas;

    const tx5 = await btmt.connect(feelessAdminWallet).addFeelessAdmin(preSale.getAddress(), {
      maxFeePerGas,
      maxPriorityFeePerGas
    });
    console.log(
      `6) Make presale contract a feeless admin transaction hash ${tx5.hash} with nonce ${tx5.nonce}`
    );
    await tx5.wait();

    const tx6 = await btmt.connect(crowdsalesWallet).approve(preSale.getAddress(), preSaleCap);
    console.log(
      `7) Give allowance to the presale contract from the crowdsales wallet transaction hash ${tx6.hash} with nonce ${tx6.nonce}`
    );
    await tx6.wait();
  }
);
