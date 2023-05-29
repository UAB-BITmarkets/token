// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @custom:security-contact security@bitmarkets.com
interface IBITMarketsTokenAllocations {
  /**
   * @dev Expects amount converted to 10 ** 18
   */
  function allocate(address beneficiary, uint256 amount, uint64 cliffSeconds) external;

  /**
   * @dev Function to withdraw already vested tokens.
   */
  function withdraw(address beneficiary) external;

  /**
   * @return the token being allocated
   */
  function token() external returns (IERC20);

  /**
   * @return the address holding the tokens initially
   */
  function wallet() external returns (address payable);

  /**
   * @return the allocations admin wallet
   */
  function admin() external returns (address);

  /**
   * @return the address of the vesting wallet.
   */
  function vestingWallet(address beneficiary) external returns (address);

  /**
   * @dev Checks the amount of tokens that can be released.
   * @return Amount of retrievable tokens from vesting wallet.
   */
  function vestedAmount(address beneficiary) external returns (uint256);
}
