// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/finance/VestingWallet.sol";

import "./BITMarketsToken.sol";

import "./utils/IBITMarketsTokenAllocations.sol";
import "./utils/IVestingWallet.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsTokenAllocations is IBITMarketsTokenAllocations {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _token;
  BITMarketsToken private _btmt;

  address payable private _tokenWallet;

  address private _allocationsAdmin;

  uint64 private _cliffSeconds;
  uint64 private _vestingDurationAfterCliffSeconds;

  mapping(address => address) public vestingWallets;

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
  function allocate(address beneficiary, uint256 amount) public virtual override {
    require(msg.sender == _allocationsAdmin, "Invalid message sender");
    require(vestingWallets[beneficiary] == address(0), "Vesting wallet exists");
    require(
      amount <=
        Math.min(_token.balanceOf(_tokenWallet), _token.allowance(_tokenWallet, address(this))),
      "Amount too large"
    );

    VestingWallet vwallet = new VestingWallet(
      beneficiary,
      // solhint-disable-next-line not-rely-on-time
      uint64(block.timestamp + _cliffSeconds),
      _vestingDurationAfterCliffSeconds
    );
    address vestingWalletAddress = address(vwallet);
    vestingWallets[beneficiary] = vestingWalletAddress;

    _btmt.addFeeless(vestingWalletAddress);
    _token.safeTransferFrom(_tokenWallet, vestingWalletAddress, amount);
  }

  /**
   * @dev Function to withdraw already vested tokens.
   */
  function withdraw(address beneficiary) public virtual override {
    address vestingWalletAddress = vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");
    // require(msg.sender == beneficiary || msg.sender == _tokenWallet, "Invalid msg sender");

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
    address vestingWalletAddress = vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");

    return vestingWalletAddress;
  }

  /**
   * @dev Checks the amount of tokens that can be released.
   * @return Amount of retrievable tokens from vesting wallet.
   */
  function vestedAmount(address beneficiary) public view override returns (uint256) {
    address vestingWalletAddress = vestingWallets[beneficiary];
    require(vestingWalletAddress != address(0), "No vesting wallet");

    IVestingWallet vwallet = IVestingWallet(vestingWalletAddress);

    // solhint-disable-next-line not-rely-on-time
    return vwallet.vestedAmount(address(_token), uint64(block.timestamp));
  }
}
