// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @custom:security-contact security@bitmarkets.com
abstract contract ERC20Fees is ERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint16 private _companyR;
  uint16 private _fundR;
  uint16 private _burnR;

  uint32 private _maxFeeless;
  uint32 private _numFeeless;

  uint256 private _minimalSupply;

  mapping(address => bool) private _feeless;

  address private _companyWallet;
  address private _companyRewardsWallet;
  address private _esgFundWallet;

  address private _feelessAdminWallet;
  mapping(address => bool) private _feelessAdmins;

  event FeelessAdminAdded(address indexed account);
  event FeelessAdded(address indexed account);
  event FeelessRemoved(address indexed account);

  /**
   * @dev Throws if called by any account that is not the feeless admin
   */
  modifier onlyFeelessAdmin() {
    require(_feelessAdminWallet == _msgSender(), "Caller not feeless admin");
    _;
  }

  /**
   * @dev Throws if called by any account that is not a feeless admin
   */
  modifier onlyFeelessAdmins() {
    require(_feelessAdmins[_msgSender()], "Caller not in feeless admins");
    _;
  }

  /**
   * @dev Constructor
   * @param finalSupply The minimum amount of token supply without the decimals
   * @param companyRate The percentage of every transfer to the company wallet (0-1000)
   * @param esgFundRate The percentage of every transfer that ends up in the ESG fund (0-1000)
   * @param companyWallet The company wallet address that gets tokens burned
   * @param companyRewardsWallet The company wallet address that receives transfer fees (can be address(0))
   * @param esgFundWallet Fund wallet address that gathers transfer fees (can be address(0))
   * @param feelessAdminWallet Feeless admin wallet address
   */
  constructor(
    uint32 finalSupply,
    uint16 companyRate,
    uint16 esgFundRate,
    uint16 burnRate,
    address companyWallet,
    address companyRewardsWallet,
    address esgFundWallet,
    address feelessAdminWallet
  ) {
    require(companyRate >= 0 && companyRate < 1000, "Company rate out of bounds");
    require(esgFundRate >= 0 && esgFundRate < 1000, "ESG Fund rate out of bounds");
    require(burnRate >= 0 && burnRate < 1000, "Burn rate out of bounds");
    require(companyWallet != address(0), "Invalid company wallet");
    require(companyRewardsWallet != address(0), "Invalid rewards wallet");
    require(esgFundWallet != address(0), "Invalid esg fund wallet");
    require(feelessAdminWallet != address(0), "Invalid admin wallet");

    _minimalSupply = finalSupply * 10 ** decimals();

    _companyR = companyRate;
    _fundR = esgFundRate;
    _burnR = burnRate;

    _companyWallet = companyWallet; // is also feeless admin
    _companyRewardsWallet = companyRewardsWallet;
    _esgFundWallet = esgFundWallet;

    _feelessAdminWallet = feelessAdminWallet;
    _feelessAdmins[feelessAdminWallet] = true;

    _maxFeeless = 1000000; // company rewards, esg fund, whitelisted crowdsale, ico.

    // _feeless[_companyWallet] = true;
    _feeless[_companyRewardsWallet] = true;
    _feeless[_esgFundWallet] = true;
    _numFeeless = 2;
  }

  function addFeelessAdmin(address contractAddress) public virtual onlyFeelessAdmin {
    require(!_feelessAdmins[contractAddress], "Already feeless admin");

    _feelessAdmins[contractAddress] = true;

    emit FeelessAdminAdded(contractAddress);
  }

  function addFeeless(address account) public virtual onlyFeelessAdmins {
    require(account != address(0), "Account is zero");
    require(!_feeless[account], "Account already feeless");
    require(_numFeeless < _maxFeeless, "Feeless limit reached");

    _feeless[account] = true;
    _numFeeless += 1;

    emit FeelessAdded(account);
  }

  function removeFeeless(address account) public virtual onlyFeelessAdmins {
    require(account != address(0), "Account is zero");

    _feeless[account] = false;
    _numFeeless -= 1;

    emit FeelessRemoved(account);
  }

  function isFeeless(address account) public view returns (bool) {
    return _feeless[account];
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._beforeTokenTransfer(from, to, amount);

    if (
      from != address(0) && // Fees not on minting
      to != address(0) && // Nor on burning
      from == _msgSender() && // Only direct transfers and not approvals
      amount > 1000 && // To be safe for underflow
      !isFeeless(from) && // To not go through this if condition many times.
      !isFeeless(to) // same
    ) {
      uint256 companyFee = amount.mul(_companyR).div(1000);
      uint256 fundFee = amount.mul(_fundR).div(1000);
      uint256 burnFee = amount.mul(_burnR).div(1000);

      amount -= companyFee.add(fundFee);

      // SafeERC20.safeTransferFrom(this, from, _companyRewardsWallet, companyFee);
      // balanceOf[_companyRewardsWallet] += companyFee;
      // SafeERC20.safeTransfer(this, _companyRewardsWallet, companyFee);
      _transfer(from, _companyRewardsWallet, companyFee);
      // _mint(_companyRewardsWallet, companyFee);

      // SafeERC20.safeTransferFrom(this, from, _esgFundWallet, fundFee);
      // balanceOf[_esgFundWallet] += fundFee;
      // SafeERC20.safeTransfer(this, _esgFundWallet, fundFee);
      _transfer(from, _esgFundWallet, fundFee);
      // _mint(_esgFundWallet, fundFee);

      uint256 totalSupplyAfterBurn = totalSupply().sub(burnFee);

      if (totalSupplyAfterBurn > _minimalSupply) {
        amount -= burnFee;

        // SafeERC20.safeTransfer(this, address(0), burnFee);
        _burn(from, burnFee);
      }
    }
  }
}
