// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @custom:security-contact security@bitmarkets.com
abstract contract ERC20Fees is ERC20, ERC20Burnable {
  uint256 private _final;
  uint16 private _burnR;
  uint16 private _buybR;
  uint16 private _fundR;
  address private _companyWallet;
  address private _fundWallet;

  // bool private companyFeesPaid = false;
  // bool private fundFeesPaid = false;
  // bool private burnHappened = false;

  /**
   * @dev Constructor
   * @param finalSupply The final number of tokens after deflation without the decimals
   * @param burnRate The percentage of every transfer to burn until final supply (0-1000)
   * @param buyBackRate The percentage of every transfer to the company wallet (0-1000)
   * @param fundRate The percentage of every transfer that ends up in the ESG fund (0-1000)
   * @param company The company wallet address that receives transfer fees (can be address(0))
   * @param fund Fund wallet address that gathers transfer fees (can be address(0))
   */
  constructor(
    uint32 finalSupply,
    uint16 burnRate,
    uint16 buyBackRate,
    uint16 fundRate,
    address company,
    address fund
  ) {
    require(burnRate >= 0 && burnRate < 1000, "Burn rate out of bounds");
    require(buyBackRate >= 0 && buyBackRate < 1000, "Buyback rate out of bounds");
    require(fundRate >= 0 && fundRate < 1000, "Fund rate out of bounds");

    _final = finalSupply * 10**decimals();
    _buybR = burnRate;
    _buybR = buyBackRate;
    _fundR = fundRate;
    _companyWallet = company;
    _fundWallet = fund;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._beforeTokenTransfer(from, to, amount);

    if (from != address(0) && to != address(0) && amount > 1000) {
      //transfer else mint || burn respectively

      // if (!companyFeesPaid) {
      uint256 companyFee = SafeMath.div(SafeMath.mul(amount, _buybR), 1000);
      _transfer(_msgSender(), _companyWallet, companyFee);
      // companyFeesPaid = true;
      amount -= companyFee;
      // }

      // if (!fundFeesPaid) {
      uint256 fundFee = SafeMath.div(SafeMath.mul(amount, _fundR), 1000);
      _transfer(_msgSender(), _fundWallet, fundFee);
      // fundFeesPaid = true;
      amount -= fundFee;
      // }

      uint256 burnFee = SafeMath.div(SafeMath.mul(amount, _burnR), 1000);
      if (totalSupply() >= _final + burnFee) {
        // TODO Burn from sender or company fund?
        _burn(_msgSender(), burnFee);
        // burnHappened = true;
      }
    }
  }

  // function _afterTokenTransfer(
  //   address from,
  //   address to,
  //   uint256 amount
  // ) internal virtual override {
  //   super._afterTokenTransfer(from, to, amount);
  //
  //   if (from != address(0) && to != address(0) && amount > 1000) {
  //     require(companyFeesPaid == true, "ERC20Fees: company unpaid");
  //     companyFeesPaid = false;
  //
  //     require(fundFeesPaid == true, "ERC20Fees: fund unpaid");
  //     fundFeesPaid = false;
  //
  //     if (totalSupply() > _final) {
  //       require(burnHappened == true, "ERC20Fees: no burn");
  //       burnHappened = false;
  //     }
  //   }
  // }
}
