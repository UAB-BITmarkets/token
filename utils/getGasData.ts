import { request } from "node:https";
import { env } from "node:process";
import { ethers } from "ethers";
import * as Sentry from "@sentry/core";

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

const getGasData = (): Promise<{
  maxFeePerGas: ethers.BigNumber;
  maxPriorityFeePerGas: ethers.BigNumber;
}> => {
  return new Promise((resolve, reject) => {
    const options = {
      host: `gasstation-${env.NODE_ENV === "production" ? "mainnet" : "mumbai"}.matic.${
        env.NODE_ENV === "production" ? "network" : "today"
      }`,
      path: `/v2`,
      port: 443,
      timeout: 30000,
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    };

    const req = request(options, (res) => {
      let data = "";

      console.log("Status Code:", res.statusCode);

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const body: GasStationResponse = JSON.parse(data);

          const maxFeePerGas = ethers.utils.parseUnits(`${Math.ceil(body.fast.maxFee)}`, "gwei");

          const maxPriorityFeePerGas = ethers.utils.parseUnits(
            `${Math.ceil(body.fast.maxPriorityFee)}`,
            "gwei"
          );

          resolve({ maxFeePerGas, maxPriorityFeePerGas });
        } catch (err) {
          Sentry.captureException(err);

          reject("Invalid response from  matic gas station.");
        }
      });
    }).on("error", (err) => {
      reject(err.message);
    });

    //On error, reject the Promise
    req.on("error", (error) => reject(error));

    //On timeout, reject the Promise
    req.on("timeout", () => {
      reject(
        new Error(`Gas station API request timed out. Current timeout is: 30000 milliseconds`)
      );
    });

    //End request
    req.end();
  });
};

export default getGasData;
