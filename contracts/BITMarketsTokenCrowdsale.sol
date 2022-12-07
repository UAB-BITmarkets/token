// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.14;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./crowdsale/Crowdsale.sol";
import "./crowdsale/AllowanceCrowdsale.sol";
import "./crowdsale/CappedCrowdsale.sol";
import "./crowdsale/InvestorTariffCapCrowdsale.sol";
import "./crowdsale/PausableCrowdsale.sol";
import "./crowdsale/TimedCrowdsale.sol";
import "./crowdsale/IncreasingPriceCrowdsale.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsTokenCrowdsale is
  Crowdsale,
  AllowanceCrowdsale,
  PausableCrowdsale,
  CappedCrowdsale,
  InvestorTariffCapCrowdsale,
  TimedCrowdsale,
  IncreasingPriceCrowdsale
{
  using SafeMath for uint256;

  // Track investor contributions
  uint256 public investorTariff = 0.002 * 10 ** 18; // 0.002 ether
  uint256 public investorCap = 50 * 10 ** 18; // 50 ether

  /**
   * @dev Constructor
   * @param initialRate Number of token units a buyer gets per wei in the beginning
   * @param wallet Address where collected funds will be forwarded to
   * @param token Address of the token being sold
   * @param cap Max amount of wei to be contributed
   * @param openingTime Crowdsale opening time
   * @param closingTime Crowdsale closing time
   * @param finalRate Number of tokens a buyer gets per wei at the end of the crowdsale
   */
  constructor(
    uint256 initialRate,
    address payable wallet,
    IERC20 token,
    uint256 cap,
    uint256 openingTime,
    uint256 closingTime,
    uint256 finalRate
  )
    Crowdsale(initialRate, wallet, token)
    AllowanceCrowdsale(wallet)
    CappedCrowdsale(cap)
    InvestorTariffCapCrowdsale(investorTariff, investorCap)
    TimedCrowdsale(openingTime, closingTime)
    IncreasingPriceCrowdsale(initialRate, finalRate)
  {
    // solhint-disable-previous-line no-empty-blocks
  }

  /**
   * @dev
   */
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
      InvestorTariffCapCrowdsale
    )
  {
    super._preValidatePurchase(beneficiary, weiAmount);
  }

  function _getTokenAmount(
    uint256 weiAmount
  ) internal view override(Crowdsale, IncreasingPriceCrowdsale) returns (uint256) {
    return super._getTokenAmount(weiAmount);
  }
}
