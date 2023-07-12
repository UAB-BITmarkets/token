// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.14;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Sale} from "./sale/Sale.sol";
import {PurchaseTariffCap} from "./sale/PurchaseTariffCap.sol";
import {TimedSale} from "./sale/TimedSale.sol";
import {Whitelist} from "./sale/Whitelist.sol";
import {Vesting} from "./sale/Vesting.sol";

import {IBITMarketsTokenPrivateSale} from "./utils/IBITMarketsTokenPrivateSale.sol";

struct SaleArgs {
  uint256 rate;
  address payable wallet;
  address payable purchaser;
  IERC20 token;
  address whitelister;
  uint256 openingTime;
  uint256 closingTime;
  uint256 investorTariff;
  uint256 investorCap;
  uint64 cliff;
  uint64 vestingDuration;
}

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsTokenPrivateSale is
  IBITMarketsTokenPrivateSale,
  Sale,
  PurchaseTariffCap,
  TimedSale,
  Whitelist,
  Vesting
{
  uint256 private _rate;

  /**
   * @dev Constructor
   */
  constructor(
    SaleArgs memory args
  )
    Sale(args.rate, args.wallet, args.purchaser, args.token)
    PurchaseTariffCap(args.investorTariff, args.investorCap)
    TimedSale(args.openingTime, args.closingTime)
    Whitelist(args.whitelister)
    Vesting(args.wallet, args.purchaser, args.cliff, args.vestingDuration)
  {
    _rate = args.rate;
  }

  function getCurrentRate() public view override returns (uint256) {
    return _rate;
  }

  function _deliverTokens(
    address beneficiary,
    uint256 tokenAmount,
    uint64 cliffSeconds
  ) internal override(Sale, Vesting) {
    super._deliverTokens(beneficiary, tokenAmount, cliffSeconds);
  }

  function _updatePurchasingState(
    address beneficiary,
    uint256 weiAmount
  ) internal override(Sale, PurchaseTariffCap) {
    super._updatePurchasingState(beneficiary, weiAmount);
  }

  function _preValidatePurchase(
    address beneficiary,
    uint256 weiAmount
  ) internal view override(Sale, TimedSale, PurchaseTariffCap, Whitelist) {
    super._preValidatePurchase(beneficiary, weiAmount);
  }
}
