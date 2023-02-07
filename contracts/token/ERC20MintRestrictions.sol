// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @dev ERC20 token with company wallet anti-corruption restrictions.
 *
 * Useful for scenarios where a company wallet with majority of tokens
 * wants to do a rugpull or when it wants to mint an excessive amount
 * of new tokens.
 */
abstract contract ERC20MintRestrictions is ERC20 {
  using SafeMath for uint256;

  /**
   * @dev To keep track of last mint
   */
  uint256 private _lastMintTime;
  uint256 private _timeRestrictionForMinting;

  address private _minterWallet;

  event MintingHappened();

  /**
   * @dev Reverts minting if less than 6 months since last mint.
   */
  modifier withMintingRestriction() {
    if (_lastMintTime != 0) {
      require(_msgSender() == _minterWallet, "Sender not minter");
    }
    // solhint-disable-next-line not-rely-on-time
    require(block.timestamp - _lastMintTime >= _timeRestrictionForMinting, "Last mint too close");
    _;
  }

  /**
   * @dev Constructor, takes months of restriction for excessive minting offence
   *
   * @param minterWallet Minter wallet
   * @param monthsOfRestrictionForMinting Months of inability to mint.
   */
  constructor(address minterWallet, uint16 monthsOfRestrictionForMinting) {
    _timeRestrictionForMinting = SafeMath.mul(monthsOfRestrictionForMinting, 30 * 24 * 60 * 60);
    _lastMintTime = 0;

    _minterWallet = minterWallet;
  }

  function minter() public view returns (address) {
    return _minterWallet;
  }

  function lastMintTimestamp() public view returns (uint256) {
    return _lastMintTime;
  }

  function timeRestrictionForMintingSeconds() public view returns (uint256) {
    return _timeRestrictionForMinting;
  }

  function canMintNow() public view returns (bool) {
    // solhint-disable-next-line not-rely-on-time
    return ((block.timestamp - _lastMintTime) >= _timeRestrictionForMinting);
  }

  /**
   * @dev See {ERC20-_mint}.
   */
  function _mint(address to, uint256 amount) internal virtual override withMintingRestriction {
    super._mint(to, amount);

    if (_lastMintTime != 0) {
      require(totalSupply() + amount <= totalSupply().div(100).mul(110), "Mint >10% total supply");
    }

    // solhint-disable-next-line not-rely-on-time
    _lastMintTime = block.timestamp;

    emit MintingHappened();
  }
}
