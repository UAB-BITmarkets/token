// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "./Crowdsale.sol";

/**
 * @dev Crowdsale in which only whitelisted users can contribute.
 */
abstract contract WhitelistCrowdsale is Crowdsale {
  // Max number of whitelisted addresses allowed
  uint32 private _maxWhitelisteds;

  // numAddressesWhitelisted would be used to keep track of how many addresses have been whitelisted
  // NOTE: Don't change this variable name, as it will be part of verification
  uint32 private _numWhitelisteds;

  // Create a mapping of whitelistedAddresses
  // if an address is whitelisted, we would set it to true, it is false by default for all other addresses.
  mapping(address => bool) private _whitelisteds;
  address private _whitelistAdmin;

  event WhitelistedAdded(address indexed account);
  event WhitelistedRemoved(address indexed account);

  /**
   * @dev Throws if called by any account other than the whitelist admin.
   */
  modifier onlyWhitelistAdmin() {
    require(isWhitelistAdmin(_msgSender()), "Caller not whitelist admin");
    _;
  }

  /**
   * @dev Throws if called by any account that is not whitelisted.
   */
  modifier onlyWhitelisted() {
    require(isWhitelisted(_msgSender()), "Caller not whitelisted");
    _;
  }

  /**
   * @dev Constructor, takes crowdsale whitelist limit.
   * @param max Crowdsale max number of whitelisted addresses.
   */
  constructor(uint32 max) {
    _whitelistAdmin = _msgSender();
    _maxWhitelisteds = max;
  }

  function addWhitelisted(address account) public virtual onlyWhitelistAdmin {
    // check if the user has already been whitelisted
    require(!_whitelisteds[account], "Account already whitelisted");
    // check if the numAddressesWhitelisted < maxWhitelistedAddresses, if not then throw an error.
    require(_numWhitelisteds < _maxWhitelisteds, "Whitelist limit reached");
    // Add the address which called the function to the whitelistedAddress array
    _whitelisteds[account] = true;
    // Increase the number of whitelisted addresses
    _numWhitelisteds += 1;
    emit WhitelistedAdded(account);
  }

  function removeWhitelisted(address account) public virtual onlyWhitelistAdmin {
    _whitelisteds[account] = false;
    emit WhitelistedRemoved(account);
  }

  /**
   * @dev Checks if an account is the whitelist admin.
   */
  function isWhitelistAdmin(address account) public view returns (bool) {
    return _whitelistAdmin == account;
  }

  /**
   * @dev Checks if an account is whitelisted.
   */
  function isWhitelisted(address account) public view returns (bool) {
    return _whitelisteds[account];
  }

  /**
   * @dev Extend parent behavior requiring beneficiary to be whitelisted. Note that no
   * restriction is imposed on the account sending the transaction.
   * @param _beneficiary Token beneficiary
   * @param _weiAmount Amount of wei contributed
   */
  function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  ) internal view virtual override {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    require(isWhitelisted(_beneficiary), "Beneficiary not whitelisted");
  }
}
