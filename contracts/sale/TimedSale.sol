// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.14;

import {Sale} from "./Sale.sol";

/**
 * @title TimedSale
 * @dev Sale accepting contributions only within a time frame.
 */
abstract contract TimedSale is Sale {
  uint256 private _openingTime;
  uint256 private _closingTime;

  /**
   * @dev Reverts if not in crowdsale time range.
   */
  modifier onlyWhileOpen() {
    require(isOpen(), "TimedCrowdsale: not open");
    _;
  }

  /**
   * @dev Constructor, takes crowdsale opening and closing times.
   * @param oTime Crowdsale opening time
   * @param cTime Crowdsale closing time
   */
  constructor(uint256 oTime, uint256 cTime) {
    // solhint-disable-next-line not-rely-on-time
    require(oTime > block.timestamp, "Crowdsale: opening early");
    require(cTime > oTime, "Crowdsale: opening < closing");

    _openingTime = oTime;
    _closingTime = cTime;
  }

  /**
   * @return the crowdsale opening time.
   */
  function openingTime() public view returns (uint256) {
    return _openingTime;
  }

  /**
   * @return the crowdsale closing time.
   */
  function closingTime() public view returns (uint256) {
    return _closingTime;
  }

  /**
   * @return true if the crowdsale is open, false otherwise.
   */
  function isOpen() public view returns (bool) {
    // solhint-disable-next-line not-rely-on-time
    return block.timestamp >= _openingTime && block.timestamp < _closingTime;
  }

  /**
   * @dev Checks whether the period in which the crowdsale is open has already elapsed.
   * @return Whether crowdsale period has elapsed
   */
  function hasClosed() public view returns (bool) {
    // solhint-disable-next-line not-rely-on-time
    return block.timestamp > _closingTime;
  }

  /**
   * @dev Extend parent behavior requiring to be within contributing period.
   * @param beneficiary Token purchaser
   * @param weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(
    address beneficiary,
    uint256 weiAmount
  ) internal view virtual override onlyWhileOpen {
    super._preValidatePurchase(beneficiary, weiAmount);
  }
}
