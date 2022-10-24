// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @custom:security-contact security@bitmarkets.com
abstract contract ERC20Fees is
  ERC20 //, ERC20Burnable {
{
  uint256 private _final;
  uint16 private _burnR;
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
   * @param finalSupply The final number of tokens after deflation without the decimals
   * @param burnRate The percentage of every transfer to burn until final supply (0-1000)
   * @param companyRate The percentage of every transfer to the company wallet (0-1000)
   * @param fundRate The percentage of every transfer that ends up in the ESG fund (0-1000)
   * @param company The company wallet address that gets tokens burned
   * @param companyRewards The company wallet address that receives transfer fees (can be address(0))
   * @param fund Fund wallet address that gathers transfer fees (can be address(0))
   */
  constructor(
    uint32 finalSupply,
    uint16 burnRate,
    uint16 companyRate,
    uint16 fundRate,
    address company,
    address companyRewards,
    address fund
  ) {
    require(burnRate >= 0 && burnRate < 1000, "Burn rate out of bounds");
    require(companyRate >= 0 && companyRate < 1000, "Company rate out of bounds");
    require(fundRate >= 0 && fundRate < 1000, "Fund rate out of bounds");

    _final = finalSupply * 10**decimals();
    _burnR = burnRate;
    _companyR = companyRate;
    _fundR = fundRate;
    _companyBurnWallet = company;
    _companyRewardsWallet = companyRewards;
    _fundWallet = fund;

    _maxFeeless = 1;
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

    if (from != address(0) && to != address(0) && amount > 1000 && !isFeeless(from) && !isFeeless(to)) {
      uint256 feesAmount = 0;

      uint256 companyFee = SafeMath.div(SafeMath.mul(amount, _companyR), 1000);
      _transfer(_msgSender(), _companyRewardsWallet, companyFee);
      feesAmount += companyFee;

      uint256 fundFee = SafeMath.div(SafeMath.mul(amount, _fundR), 1000);
      _transfer(_msgSender(), _fundWallet, fundFee);
      feesAmount += fundFee;

      uint256 burnFee = SafeMath.div(SafeMath.mul(amount, _burnR), 1000);
      if (totalSupply() >= _final + burnFee) {
        // TODO Burn from sender or company fund?
        _burn(_companyBurnWallet, burnFee);
      }

      amount -= feesAmount;
    }
  }
}
