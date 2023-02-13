// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

/// @custom:security-contact security@bitmarkets.com
interface IBITMarketsTokenPrivateSale {
  function getCurrentRate() external view returns (uint256);
}
