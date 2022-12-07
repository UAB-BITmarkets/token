// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.14;

import "@openzeppelin/contracts/security/Pausable.sol";

import "./Crowdsale.sol";

/**
 * @title PausableCrowdsale
 * @dev Extension of Crowdsale contract where purchases can be paused and unpaused by the pauser role.
 */
abstract contract PausableCrowdsale is Crowdsale, Pausable {
  // /**
  //  * @param r Number of token units a buyer gets per wei (rate)
  //  * @param w Address where collected funds will be forwarded to (wallet)
  //  * @param t Address of the token being sold (token)
  //  */
  // constructor(
  //     uint256 r,
  //     address payable w,
  //     IERC20 t
  // ) Crowdsale(r,w,t) {}

  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met.
   * Use super to concatenate validations.
   * Adds the validation that the crowdsale must not be paused.
   * @param beneficiary Address performing the token purchase
   * @param weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(
    address beneficiary,
    uint256 weiAmount
  ) internal view virtual override whenNotPaused {
    super._preValidatePurchase(beneficiary, weiAmount);
  }
}
