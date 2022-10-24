// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev ERC20 token with blacklist.
 *
 * Useful for scenarios such as preventing trades from accounts
 * that do not adhere to the community guidelines.
 */
abstract contract ERC20Blacklistable is ERC20 {
  // Max number of blacklisted addresses allowed
  uint32 private _maxBlacklisteds;

  // numAddressesBlacklisted would be used to keep track of how many addresses have been blacklisted
  // NOTE: Don't change this variable name, as it will be part of verification
  uint32 private _numBlacklisteds;

  // Create a mapping of whitelistedAddresses
  // if an address is whitelisted, we would set it to true, it is false by default for all other addresses.
  mapping(address => bool) private _blacklisteds;
  address private _blacklistAdmin;

  event BlacklistedAdded(address indexed account);
  event BlacklistedRemoved(address indexed account);

  /**
   * @dev Throws if called by any account other than the blacklist admin.
   */
  modifier onlyBlacklistAdmin() {
    require(isBlacklistAdmin(_msgSender()), "Caller not blacklist admin");
    _;
  }

  /**
   * @dev Throws if called by any account that is blacklisted.
   */
  modifier onlyNotBlacklisted() {
    require(!isBlacklisted(_msgSender()), "Caller blacklisted");
    _;
  }

  /**
   * @dev Constructor, takes crowdsale blacklist limit.
   * @param max Crowdsale max number of blacklisted addresses.
   */
  constructor(uint32 max) {
    _blacklistAdmin = _msgSender();
    _maxBlacklisteds = max;
  }

  function addBlacklisted(address account) public virtual onlyBlacklistAdmin {
    // check if the user has already been blacklisted
    require(!_blacklisteds[account], "Account already blacklisted");
    require(account != address(0), "Account is zero");
    // check if the numAddressesBlacklisted < maxBlacklistedAddresses, if not then throw an error.
    require(_numBlacklisteds < _maxBlacklisteds, "Blacklist limit reached");
    // Add the address which called the function to the blacklistedAddress array
    _blacklisteds[account] = true;
    // Increase the number of blacklisted addresses
    _numBlacklisteds += 1;
    emit BlacklistedAdded(account);
  }

  function removeBlacklisted(address account) public virtual onlyBlacklistAdmin {
    require(account != address(0), "Account is zero");
    _blacklisteds[account] = false;
    _numBlacklisteds -= 1;
    emit BlacklistedRemoved(account);
  }

  /**
   * @dev Checks if an account is the blacklist admin.
   */
  function isBlacklistAdmin(address account) public view returns (bool) {
    return _blacklistAdmin == account;
  }

  /**
   * @dev Checks if an account is blacklisted.
   */
  function isBlacklisted(address account) public view returns (bool) {
    return _blacklisteds[account];
  }

  /**
   * @dev See {ERC20-_beforeTokenTransfer}.
   *
   * Requirements:
   *
   * - the accounts must not be blacklisted.
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._beforeTokenTransfer(from, to, amount);

    require(!isBlacklisted(from), "From is blacklisted");
    require(!isBlacklisted(to), "To is blacklisted");
  }
}
