// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/finance/VestingWallet.sol";

import "./Crowdsale.sol";

import "../utils/IVestingWallet.sol";

/**
 * @title VestingCrowdsale
 * @dev Extension of Crowdsale where allowance tokens are locked by the crowdsale contract
 * with some cliff and vesting period.
 * Cannot be used with AllowanceCrowdsale
 */
abstract contract VestingCrowdsale is Crowdsale {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  address private _tokenWallet;

  uint64 private _cliffAfterMilliseconds;
  uint64 private _vestingDurationAfterCliffMilliseconds;

  mapping(address => address) public vestingWallets;
  mapping(address => bool) public vestingWalletExists;

  /**
   * @dev Constructor, takes token wallet address.
   * @param wallet Address holding the tokens, which has approved allowance to the crowdsale.
   * @param cliff The time in milliseconds after locking occurs when vesting begins.
   * @param vestingDuration The time in milliseconds after cliff happens when tokens are being released in a
   * linear fashion.
   */
  constructor(address wallet, uint64 cliff, uint64 vestingDuration) {
    // solhint-disable-next-line max-line-length
    require(wallet != address(0), "Crowdsale: wallet 0 address");

    _tokenWallet = wallet;
    _cliffAfterMilliseconds = cliff;
    _vestingDurationAfterCliffMilliseconds = vestingDuration;
  }

  /**
   * @dev Function to withdraw already vested tokens.
   */
  function withdrawTokens() public {
    require(vestingWalletExists[msg.sender], "No vesting wallet");

    address vwalletAddress = vestingWallets[msg.sender];
    IVestingWallet vwallet = IVestingWallet(vwalletAddress);
    vwallet.release(address(token()));

    if (remainingTokens() == 0) {
      delete vestingWallets[msg.sender];
      delete vestingWalletExists[msg.sender];
    }
  }

  // AllowanceCrowdsale related

  /**
   * @return the address of the wallet that will hold the tokens.
   */
  function tokenWallet() public view returns (address) {
    return _tokenWallet;
  }

  /**
   * @dev Checks the amount of tokens left in the allowance.
   * @return Amount of tokens left in the allowance
   */
  function remainingTokens() public view returns (uint256) {
    return
      Math.min(token().balanceOf(_tokenWallet), token().allowance(_tokenWallet, address(this)));
  }

  /**
   * @return the address of the vesting wallet.
   */
  function vestingWallet(address beneficiary) public view returns (address) {
    require(vestingWalletExists[beneficiary], "No vesting wallet");

    return vestingWallets[beneficiary];
  }

  /**
   * @dev Checks the amount of tokens that can be released.
   * @return Amount of retrievable tokens from vesting wallet.
   */
  function vestedAmount(address beneficiary) public view returns (uint256) {
    require(vestingWalletExists[beneficiary], "No vesting wallet");

    IVestingWallet vwallet = IVestingWallet(vestingWallets[beneficiary]);

    return vwallet.vestedAmount(address(token()), uint64(block.timestamp));
  }

  /**
   * @dev Overrides parent behavior by transferring tokens to the vesting wallets.
   * @param beneficiary Token purchaser
   * @param tokenAmount Amount of tokens purchased
   */
  function _deliverTokens(address beneficiary, uint256 tokenAmount) internal virtual override {
    require(remainingTokens() >= tokenAmount, "Allowance too low");

    uint64 cliff = uint64(SafeMath.add(block.timestamp, uint256(_cliffAfterMilliseconds)));
    uint64 vesting = uint64(SafeMath.add(cliff, uint256(_vestingDurationAfterCliffMilliseconds)));

    bool exists = vestingWalletExists[beneficiary];

    address vestingWalletAddress;

    if (!exists) {
      VestingWallet vwallet = new VestingWallet(beneficiary, cliff, vesting);
      vestingWalletAddress = address(vwallet);
    } else {
      vestingWalletAddress = vestingWallets[beneficiary]; 
    }

    // No fees here since _tokenWallet is feeless
    token().safeTransferFrom(_tokenWallet, vestingWalletAddress, tokenAmount);

    tokenAmount = 0;

    if (!exists) {
      vestingWallets[beneficiary] = vestingWalletAddress;
      vestingWalletExists[beneficiary] = true;
    }

    super._deliverTokens(beneficiary, tokenAmount);
  }
}
