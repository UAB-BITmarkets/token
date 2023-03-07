// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import {Sale} from "./sale/Sale.sol";
import {PurchaseTariffCap} from "./sale/PurchaseTariffCap.sol";
import {TimedSale} from "./sale/TimedSale.sol";
import {IncreasingPrice} from "./sale/IncreasingPrice.sol";
import {Vesting} from "./sale/Vesting.sol";

/**
 * @param initialRate Number of token units a buyer gets per wei in the beginning
 * @param finalRate Number of tokens a buyer gets per wei at the end of the crowdsale
 * @param wallet Address where collected funds will be forwarded to
 * @param token Address of the token being sold
 * @param cap Max amount of wei to be contributed
 * @param openingTime Crowdsale opening time
 * @param closingTime Crowdsale closing time
 * @param investorTariff Minimum amount that participant can deposit
 * @param investorCap Maximum amount that participant can deposit
 * @param cliff Tokens stay locked in vesting wallet until that time
 * @param vestingDuration Tokens are released linearly until then
 */
struct SaleArgs {
  uint256 initialRate;
  uint256 finalRate;
  address payable wallet;
  address payable purchaser;
  IERC20 token;
  uint256 openingTime;
  uint256 closingTime;
  uint256 investorTariff;
  uint256 investorCap;
  uint64 cliff;
  uint64 vestingDuration;
}

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsTokenPublicSale is Sale, PurchaseTariffCap, TimedSale, IncreasingPrice, Vesting {
  using SafeMath for uint256;

  /**
   * @dev Constructor
   */
  constructor(
    SaleArgs memory args
  )
    Sale(args.initialRate, args.wallet, args.purchaser, args.token)
    PurchaseTariffCap(args.investorTariff, args.investorCap)
    TimedSale(args.openingTime, args.closingTime)
    IncreasingPrice(args.initialRate, args.finalRate)
    Vesting(args.wallet, args.cliff, args.vestingDuration)
  {
    // solhint-disable-previous-line no-empty-blocks
  }

  /**
   * @dev
   */
  function _deliverTokens(
    address beneficiary,
    uint256 tokenAmount
  ) internal override(Sale, Vesting) {
    super._deliverTokens(beneficiary, tokenAmount);
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
  ) internal view override(Sale, TimedSale, PurchaseTariffCap) {
    super._preValidatePurchase(beneficiary, weiAmount);
  }

  function _getTokenAmount(
    uint256 weiAmount
  ) internal view override(Sale, IncreasingPrice) returns (uint256) {
    return super._getTokenAmount(weiAmount);
  }
}
