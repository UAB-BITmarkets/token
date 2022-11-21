// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";

/// @custom:security-contact security@bitmarkets.com
abstract contract ERC20Fees is ERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint16 private _companyR;
  uint16 private _fundR;

  uint32 private _maxFeeless;
  uint32 private _numFeeless;

  mapping(address => bool) private _feeless;

  address private _companyBurnWallet;
  address private _companyRewardsWallet;
  address private _fundWallet;

  event FeelessAdded(address indexed account);
  event FeelessRemoved(address indexed account);

  /**
   * @dev Constructor
   * @param companyRate The percentage of every transfer to the company wallet (0-1000)
   * @param esgFundRate The percentage of every transfer that ends up in the ESG fund (0-1000)
   * @param companyWallet The company wallet address that gets tokens burned
   * @param companyRewards The company wallet address that receives transfer fees (can be address(0))
   * @param esgFund Fund wallet address that gathers transfer fees (can be address(0))
   */
  constructor(
    uint16 companyRate,
    uint16 esgFundRate,
    address companyWallet,
    address companyRewards,
    address esgFund
  ) {
    require(companyRate >= 0 && companyRate < 1000, "Company rate out of bounds");
    require(esgFundRate >= 0 && esgFundRate < 1000, "ESG Fund rate out of bounds");

    _companyR = companyRate;
    _fundR = esgFundRate;
    _companyBurnWallet = companyWallet; // is also feeless admin
    _companyRewardsWallet = companyRewards;
    _fundWallet = esgFund;

    _maxFeeless = 4; // company wallet, company gains, esg fund and crowdsale.

    _feeless[_companyBurnWallet] = true;
    _feeless[_companyRewardsWallet] = true;
    _feeless[_fundWallet] = true;
    _numFeeless = 3;
  }

  function addFeeless(address account) public virtual {
    require(_msgSender() == _companyBurnWallet, "Not feeless admin");
    require(account != address(0), "Account is zero");
    require(!_feeless[account], "Account already feeless");
    require(_numFeeless < _maxFeeless, "Feeless limit reached");
    _feeless[account] = true;
    _numFeeless += 1;
    emit FeelessAdded(account);
  }

  function removeFeeless(address account) public virtual {
    require(_msgSender() == _companyBurnWallet, "Not feeless admin");
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
      from != address(0) &&
      to != address(0) &&
      amount > 1000 &&
      !isFeeless(from) && // to not go through this if condition many times.
      !isFeeless(to) && // same
      balanceOf(from) >= amount
    ) {
      uint256 companyFee = SafeMath.div(SafeMath.mul(amount, _companyR), 1000);
      uint256 fundFee = SafeMath.div(SafeMath.mul(amount, _fundR), 1000);

      amount -= companyFee + fundFee;

      // SafeERC20.safeTransferFrom(this, from, _companyRewardsWallet, companyFee);
      // balances[_companyRewardsWallet] += companyFee;
      // SafeERC20.safeTransfer(this, _companyRewardsWallet, companyFee);
      _transfer(from, _companyRewardsWallet, companyFee);

      // SafeERC20.safeTransferFrom(this, from, _fundWallet, fundFee);
      // balances[_fundWallet] += fundFee;
      // SafeERC20.safeTransfer(this, _fundWallet, fundFee);
      _transfer(from, _fundWallet, fundFee);
    }
  }
}
