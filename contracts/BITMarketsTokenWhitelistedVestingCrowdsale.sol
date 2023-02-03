// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./crowdsale/Crowdsale.sol";
import "./crowdsale/CappedCrowdsale.sol";
import "./crowdsale/InvestorTariffCapCrowdsale.sol";
import "./crowdsale/PausableCrowdsale.sol";
import "./crowdsale/TimedCrowdsale.sol";
import "./crowdsale/WhitelistCrowdsale.sol";
import "./crowdsale/VestingCrowdsale.sol";

struct CrowdsaleArgs {
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
contract BITMarketsTokenWhitelistedVestingCrowdsale is
  Crowdsale,
  PausableCrowdsale,
  CappedCrowdsale,
  InvestorTariffCapCrowdsale,
  TimedCrowdsale,
  WhitelistCrowdsale,
  VestingCrowdsale
{
  using SafeMath for uint256;

  uint256 private _rate;

  /**
   * @dev Constructor
   */
  constructor(
    CrowdsaleArgs memory args
  )
    Crowdsale(args.rate, args.wallet, args.purchaser, args.token)
    CappedCrowdsale(args.cap)
    InvestorTariffCapCrowdsale(args.investorTariff, args.investorCap)
    TimedCrowdsale(args.openingTime, args.closingTime)
    WhitelistCrowdsale(args.whitelister, args.maxWhitelisted)
    VestingCrowdsale(args.wallet, args.cliff, args.vestingDuration)
  {
    _rate = args.rate;
  }

  function getCurrentRate() public view virtual returns (uint256) {
    return _rate;
  }

  function _deliverTokens(
    address beneficiary,
    uint256 tokenAmount
  ) internal override(Crowdsale, VestingCrowdsale) {
    super._deliverTokens(beneficiary, tokenAmount);
  }

  function _updatePurchasingState(
    address beneficiary,
    uint256 weiAmount
  ) internal override(Crowdsale, InvestorTariffCapCrowdsale) {
    super._updatePurchasingState(beneficiary, weiAmount);
  }

  // TODO Disallow from blacklisted accounts
  function _preValidatePurchase(
    address beneficiary,
    uint256 weiAmount
  )
    internal
    view
    override(
      Crowdsale,
      PausableCrowdsale,
      CappedCrowdsale,
      TimedCrowdsale,
      InvestorTariffCapCrowdsale,
      WhitelistCrowdsale
    )
  {
    super._preValidatePurchase(beneficiary, weiAmount);
  }
}
