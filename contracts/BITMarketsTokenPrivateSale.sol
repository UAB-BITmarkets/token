// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./sale/Sale.sol";
import "./sale/CappedSale.sol";
import "./sale/PurchaseTariffCap.sol";
import "./sale/PausableSale.sol";
import "./sale/TimedSale.sol";
import "./sale/Whitelist.sol";
import "./sale/Vesting.sol";

import "./utils/IBITMarketsTokenPrivateSale.sol";

struct SaleArgs {
  uint256 rate;
  address payable wallet;
  address payable purchaser;
  IERC20 token;
  address whitelister;
  uint256 cap;
  uint32 maxWhitelisted;
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
  PausableSale,
  CappedSale,
  PurchaseTariffCap,
  TimedSale,
  Whitelist,
  Vesting
{
  using SafeMath for uint256;

  uint256 private _rate;

  /**
   * @dev Constructor
   */
  constructor(
    SaleArgs memory args
  )
    Sale(args.rate, args.wallet, args.purchaser, args.token)
    CappedSale(args.cap)
    PurchaseTariffCap(args.investorTariff, args.investorCap)
    TimedSale(args.openingTime, args.closingTime)
    Whitelist(args.whitelister, args.maxWhitelisted)
    Vesting(args.wallet, args.cliff, args.vestingDuration)
  {
    _rate = args.rate;
  }

  function getCurrentRate() public view override returns (uint256) {
    return _rate;
  }

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
  )
    internal
    view
    override(
      Sale,
      PausableSale,
      CappedSale,
      TimedSale,
      PurchaseTariffCap,
      Whitelist
    )
  {
    super._preValidatePurchase(beneficiary, weiAmount);
  }
}
