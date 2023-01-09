// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.14;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./crowdsale/Crowdsale.sol";
import "./crowdsale/AllowanceCrowdsale.sol";
import "./crowdsale/CappedCrowdsale.sol";
import "./crowdsale/InvestorTariffCapCrowdsale.sol";
import "./crowdsale/PausableCrowdsale.sol";
import "./crowdsale/TimedCrowdsale.sol";
import "./crowdsale/WhitelistCrowdsale.sol";

// import "./crowdsale/FinalizableCrowdsale.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsTokenWhitelistedCrowdsale is
  Crowdsale,
  AllowanceCrowdsale,
  PausableCrowdsale,
  CappedCrowdsale,
  InvestorTariffCapCrowdsale,
  TimedCrowdsale,
  WhitelistCrowdsale
{
  using SafeMath for uint256;

  // Track investor contributions
  uint256 public investorTariff = 0.002 * 10 ** 18; // 0.002 ether
  uint256 public investorCap = 50 * 10 ** 18; // 50 ether

  // // Token Distribution
  // uint256 public tokenSalePercentage   = 70;
  // uint256 public foundersPercentage    = 20;
  // uint256 public foundationPercentage  = 20;
  // uint256 public partnersPercentage    = 10;

  /**
   * @dev Constructor
   * @param rate Number of token units a buyer gets per wei
   * @param wallet Address where collected funds will be forwarded to
   * @param token Address of the token being sold
   * @param cap Max amount of wei to be contributed
   * @param maxWhitelisted Max number of whitelisted addresses
   * @param openingTime Crowdsale opening time
   * @param closingTime Crowdsale closing time
   */
  constructor(
    uint256 rate,
    address payable wallet,
    IERC20 token,
    uint256 cap,
    uint32 maxWhitelisted,
    uint256 openingTime,
    uint256 closingTime
  )
    Crowdsale(rate, wallet, token)
    AllowanceCrowdsale(wallet)
    CappedCrowdsale(cap)
    InvestorTariffCapCrowdsale(investorTariff, investorCap)
    TimedCrowdsale(openingTime, closingTime)
    WhitelistCrowdsale(wallet, maxWhitelisted)
  {
    // solhint-disable-previous-line no-empty-blocks
  }

  function _deliverTokens(
    address beneficiary,
    uint256 tokenAmount
  ) internal override(Crowdsale, AllowanceCrowdsale) {
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

  // function _getTokenAmount(uint256 weiAmount)
  //   internal
  //   view
  //   override(Crowdsale, IncreasingPriceCrowdsale)
  //   returns (uint256)
  // {
  //   return super._getTokenAmount(weiAmount);
  // }
}
