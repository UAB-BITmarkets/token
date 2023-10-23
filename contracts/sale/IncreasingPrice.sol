// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.14;

import {TimedSale} from "./TimedSale.sol";

/**
 * @title IncreasingPriceSale
 * @dev Extension of sale contract that increases the price of tokens linearly in time.
 * Note that what should be provided to the constructor is the initial and final _rates_, that is,
 * the amount of tokens per wei contributed. Thus, the initial rate must be greater than the final rate.
 */
abstract contract IncreasingPrice is TimedSale {
  uint256 private _initialRate;
  uint256 private _finalRate;

  /**
   * @dev Constructor, takes initial and final rates of tokens received per wei contributed.
   * @param iRate Number of tokens a buyer gets per wei at the start of the crowdsale (initial rate)
   * @param fRate Number of tokens a buyer gets per wei at the end of the crowdsale (final rate)
   */
  constructor(uint256 iRate, uint256 fRate) {
    require(fRate > 0, "Crowdsale: final rate 0");
    // solhint-disable-next-line max-line-length
    require(iRate > fRate, "Crowdsale: initial > final rate");
    _initialRate = iRate;
    _finalRate = fRate;
  }

  /**
   * @return the initial rate of the crowdsale.
   */
  function initialRate() public view returns (uint256) {
    return _initialRate;
  }

  /**
   * @return the final rate of the crowdsale.
   */
  function finalRate() public view returns (uint256) {
    return _finalRate;
  }

  /**
   * @dev Returns the rate of tokens per wei at the present time.
   * Note that, as price _increases_ with time, the rate _decreases_.
   * @return The number of tokens a buyer gets per wei at a given time
   */
  function getCurrentRate() public view returns (uint256) {
    if (!isOpen()) {
      return 0;
    }

    // solhint-disable-next-line not-rely-on-time
    uint256 elapsedTime = block.timestamp - openingTime();
    uint256 timeRange = closingTime() - openingTime();
    uint256 rateRange = _initialRate - _finalRate;
    return _initialRate - (elapsedTime * rateRange) / timeRange;
  }

  /**
   * @dev Overrides parent method taking into account variable rate.
   * @param weiAmount The value in wei to be converted into tokens
   * @return The number of tokens _weiAmount wei will buy at present time
   */
  function _getTokenAmount(uint256 weiAmount) internal view virtual override returns (uint256) {
    // uint256 currentRate = getCurrentRate();
    // return currentRate * weiAmount;
    uint256 elapsedTime = block.timestamp - openingTime();
    uint256 timeRange = closingTime() - openingTime();
    uint256 rateRange = _initialRate - _finalRate;

    return weiAmount * _initialRate - (weiAmount * elapsedTime * rateRange) / timeRange;
  }
}
