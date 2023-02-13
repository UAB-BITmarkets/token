// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/// @custom:security-contact security@bitmarkets.com
interface IBITMarketsToken {
  /**
   * @dev Takes snapshot of state and can return to it
   */
  function snapshot() external;

  /**
   * @dev Freezes transfers, burning, minting
   */
  function pause() external;

  /**
   * @dev Unfreezes transfers, burning, minting
   */
  function unpause() external;
}
