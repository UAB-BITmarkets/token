// import { request } from "node:https";
// import { env } from "node:process";
import { ethers } from "ethers";
// import * as Sentry from "@sentry/core";

export interface FeesResponse {
  maxFee: number;
  maxPriorityFee: number;
}

export interface GasStationResponse {
  safeLow: FeesResponse;
  standard: FeesResponse;
  fast: FeesResponse;
  estimatedBaseFee: number;
  blockTime: number;
  blockNumber: number;
}

const getGasData = async (): Promise<{
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> => {
  // return new Promise((resolve, reject) => {
  //   const options = {
  //     host: `gasstation.polygon.technology`,
  //     path: `/v2`,
  //     port: 443,
  //     timeout: 30000,
  //     method: "GET",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //   };

  const req = await fetch("https://gasstation.polygon.technology/v2");
  const body: GasStationResponse = await req.json();

  // const req = request(options, (res) => {
  //   let data = "";
  //
  //   console.log("Status Code:", res.statusCode);
  //
  //   res.on("data", (chunk) => {
  //     data += chunk;
  //   });
  //
  //   res.on("end", () => {
  //     try {
  //       console.log(data);
  //       const body: GasStationResponse = JSON.parse(data);

  const maxFeePerGas = ethers.parseUnits(`${Math.ceil(body.fast.maxFee)}`, "gwei");

  const maxPriorityFeePerGas = ethers.parseUnits(
    `${Math.ceil(body.fast.maxPriorityFee)}`,
    "gwei"
  );

  // resolve({ maxFeePerGas, maxPriorityFeePerGas });
  return { maxFeePerGas, maxPriorityFeePerGas };
  //     } catch (err) {
  //       Sentry.captureException(err);
  //
  //       reject("Invalid response from  matic gas station.");
  //     }
  //   });
  // }).on("error", (err) => {
  //   reject(err.message);
  // });

  //On error, reject the Promise
  // req.on("error", (error) => reject(error));

  //On timeout, reject the Promise
  // req.on("timeout", () => {
  //   reject(
  //     new Error(
  //       `Gas station API request timed out. Current timeout is: 30000 milliseconds`,
  //     ),
  //   );
  // });

  //End request
  // req.end();
  // });
};

export default getGasData;
