// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.14;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {VestingWallet} from "@openzeppelin/contracts/finance/VestingWallet.sol";

import {BITMarketsToken} from "./BITMarketsToken.sol";

import {IBITMarketsTokenAllocations} from "./utils/IBITMarketsTokenAllocations.sol";
import {IVestingWallet} from "./utils/IVestingWallet.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsTokenAllocations is IBITMarketsTokenAllocations {
  using SafeERC20 for IERC20;

  IERC20 private _token;
  BITMarketsToken private _btmt;

  address payable private _tokenWallet;

  address private _allocationsAdmin;

  uint64 private _cliffSeconds;
  uint64 private _vestingDurationAfterCliffSeconds;

  mapping(address => address) public _vestingWallets;

  /**
   * @dev Constructor
   *
   * @param w The wallet holding the tokens to be allocated
   * @param allocationsAdminWallet The wallet that can call allocate
   * @param t Address of the token being sold (token)
   * @param cliff Seconds after current timestamp that tokens are locked
   * @param vesting Seconds after cliff is finished where tokens vest linearly
   */
  constructor(
    address payable w,
    address allocationsAdminWallet,
    IERC20 t,
    uint64 cliff,
    uint64 vesting
  ) {
    require(address(t) != address(0), "Token 0 address");
    require(w != address(0), "Token wallet 0 address");
    require(allocationsAdminWallet != address(0), "Admin wallet 0 address");

    _tokenWallet = w;
    _allocationsAdmin = allocationsAdminWallet;
    _token = t;
    _btmt = BITMarketsToken(address(t));

    _cliffSeconds = cliff;
    _vestingDurationAfterCliffSeconds = vesting;
  }

  /**
   * @dev Expects amount converted to 10 ** 18
   */
  function allocate(address beneficiary, uint256 amount, uint64 cliffSeconds) public virtual override {
    require(msg.sender == _allocationsAdmin, "Invalid message sender");
    require(
      amount <=
        Math.min(_token.balanceOf(_tokenWallet), _token.allowance(_tokenWallet, address(this))),
      "Amount too large"
    );

    address vestingWalletAddress = _vestingWallets[beneficiary];

    if (vestingWalletAddress == address(0)) {
      uint64 cliffAdd = cliffSeconds > 0 && cliffSeconds < _cliffSeconds
        ? cliffSeconds
        : _cliffSeconds;

      VestingWallet vwallet = new VestingWallet(
        beneficiary,
        // solhint-disable-next-line not-rely-on-time
        uint64(block.timestamp + cliffAdd),
        _vestingDurationAfterCliffSeconds
      );
      _vestingWallets[beneficiary] = address(vwallet);
      vestingWalletAddress = address(vwallet);

      _btmt.addFeeless(vestingWalletAddress);
    }

    _token.safeTransferFrom(_tokenWallet, vestingWalletAddress, amount);
  }

  /**
   * @dev Function to withdraw already vested tokens.
   */
  function withdraw(address beneficiary) public virtual override {
    address vestingWalletAddress = _vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");

    IVestingWallet vwallet = IVestingWallet(vestingWalletAddress);

    vwallet.release(address(_token));
  }

  /**
   * @return the token being allocated
   */
  function token() public view override returns (IERC20) {
    return _token;
  }

  /**
   * @return the address holding the tokens initially
   */
  function wallet() public view override returns (address payable) {
    return _tokenWallet;
  }

  /**
   * @return the allocations admin wallet
   */
  function admin() public view override returns (address) {
    return _allocationsAdmin;
  }

  /**
   * @return the address of the vesting wallet.
   */
  function vestingWallet(address beneficiary) public view override returns (address) {
    address vestingWalletAddress = _vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");

    return vestingWalletAddress;
  }

  /**
   * @dev Checks the cliff timestamp of the beneficiary's vesting wallet.
   * @return Amount of retrievable tokens from vesting wallet.
   */
  function getVestingWalletCliff(address beneficiary) public view returns (uint256) {
    address vestingWalletAddress = _vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");

    IVestingWallet vwallet = IVestingWallet(vestingWalletAddress);

    // solhint-disable-next-line not-rely-on-time
    return vwallet.start();
  }

  /**
   * @dev Checks the amount of tokens that can be released.
   * @return Amount of retrievable tokens from vesting wallet.
   */
  function vestedAmount(address beneficiary) public view override returns (uint256) {
    address vestingWalletAddress = _vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");

    IVestingWallet vwallet = IVestingWallet(vestingWalletAddress);

    // solhint-disable-next-line not-rely-on-time
    return vwallet.vestedAmount(address(_token), uint64(block.timestamp));
  }
}
