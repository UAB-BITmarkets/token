// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "hardhat/console.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Crowdsale.sol";

/**
 * @title InvestorlyCappedCrowdsale
 * @dev Crowdsale with per-beneficiary caps.
 */
abstract contract InvestorTariffCapCrowdsale is Crowdsale {
  using SafeMath for uint256;

  mapping(address => uint256) private _contributions;

  uint256 private _tariff;
  uint256 private _cap;

  /**
   * @dev Constructor, takes minimum amount of wei accepted in the crowdsale.
   * @param t Min amount of wei to be contributed (tariff)
   * @param c Max amount of wei to be contributed (cap)
   */
  constructor(uint256 t, uint256 c) {
    require(t > 0, "Crowdsale: tariff 0");
    require(c > t, "Crowdsale: cap < tariff");

    _tariff = t;
    _cap = c;
  }

  /**
   * @dev Returns the investor cap of the crowdsale.
   * @return Returns the investor cap of the crowdsale.
   */
  function getInvestorCap() public view returns (uint256) {
    return _cap;
  }

  /**
   * @dev Returns the investor tariff of the crowdsale.
   * @return Returns the investor tariff of the crowdsale.
   */
  function getInvestorTariff() public view returns (uint256) {
    return _tariff;
  }

  /**
   * @dev Returns the amount contributed so far by a specific beneficiary.
   * @param beneficiary Address of contributor
   * @return Beneficiary contribution so far
   */
  function getContribution(address beneficiary) public view returns (uint256) {
    return _contributions[beneficiary];
  }

  /**
   * @dev Extend parent behavior to update beneficiary contributions.
   * @param beneficiary Token purchaser
   * @param weiAmount Amount of wei contributed
   */
  function _updatePurchasingState(
    address beneficiary,
    uint256 weiAmount
  ) internal virtual override {
    super._updatePurchasingState(beneficiary, weiAmount);

    _contributions[beneficiary] = _contributions[beneficiary].add(weiAmount);
  }

  /**
   * @dev Extend parent behavior requiring purchase to respect the beneficiary's funding cap.
   * @param beneficiary Token purchaser
   * @param weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(
    address beneficiary,
    uint256 weiAmount
  ) internal view virtual override {
    super._preValidatePurchase(beneficiary, weiAmount);

    require(weiAmount >= _tariff, "Crowdsale: wei < tariff");
    require(weiAmount <= _cap, "Crowdsale: wei > cap");
    require(_contributions[beneficiary].add(weiAmount) <= _cap, "Crowdsale: cap >= hardCap");
  }
}
