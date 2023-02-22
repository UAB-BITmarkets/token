// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

struct StrategicWallet {
  address approvedReceiver;
  uint256 amountTransferred;
  uint256 amountTransferredLimit;
}

/**
 * @dev ERC20 token with company wallet anti-corruption restrictions.
 *
 * Useful for scenarios where a company wallet with majority of tokens
 * wants to do a rugpull or when it wants to mint an excessive amount
 * of new tokens.
 */
abstract contract ERC20StrategicWalletRestrictions is ERC20 {
  using SafeMath for uint256;

  /**
   * @dev The executive wallet that can provide the above lifting of restriction
   */
  address private _restrictionAdminWallet;

  /**
   * @dev The crowdsales and allocations wallets give allowances to smart contracts.
   * These two strategic wallets can only transfer there.
   * In case a large transfer from the company liquidity wallet needs to happen,
   * it needs to get approved by the executive with the _restrictionAdminWallet.
   * This transfer can only happen once and then the approved receiver is removed.
   */
  mapping(address => bool) private _isStrategicWallet;
  mapping(address => StrategicWallet) private _strategicWallet;

  /**
   * @dev This is specific to the company liquidity wallet for universal transfers.
   * The other two strategic wallets can transfer only to their approved contracts.
   */
  address private _companyLiquidityWallet;
  uint256 private _companyLiquidityTransfers;
  uint256 private _companyLiquidityTransfersLimit;
  uint256 private _companyLiquidityTransfersLockStartTime;
  uint256 private _companyLiquidityTransfersLockPeriod;

  event StrategicWalletCapReached(address wallet);
  event UnrestrictedReceiverAdded(address wallet, address receiver, uint256 amountLimit);
  event UnrestrictedReceiverRemoved(address wallet);
  event UnrestrictedTransferOccured(address wallet, address receiver, uint256 amount);

  modifier onlyRestrictionsAdmin() {
    require(_msgSender() == _restrictionAdminWallet, "Only restrictor");
    _;
  }

  /**
   * @dev Reverts if strategic wallet has accumulated transfers of
   * more than some amount and has been locked.
   */
  modifier withStrategicWalletRestriction(
    address from,
    address to,
    uint256 amount
  ) {
    // If minting or burning or non-strategic sender we do not care
    if (to != address(0) && _isStrategicWallet[from]) {
      bool isTransfer = from == _msgSender();
      bool fromIsCompanyLiquidityWallet = from == _companyLiquidityWallet;
      StrategicWallet memory strategicWallet = _strategicWallet[from];

      if (isTransfer && strategicWallet.approvedReceiver != to) {
        // Only company liquidity is allowed to send to unapproved addresses.
        require(_msgSender() == _companyLiquidityWallet, "Illegal transfer");

        // Require unlocked company liquidity
        require(
          // solhint-disable-next-line not-rely-on-time
          block.timestamp >
            _companyLiquidityTransfersLockStartTime.add(_companyLiquidityTransfersLockPeriod),
          "Last max transfer too close"
        );
      } else if (isTransfer) {
        // Require the approved amount to be less than the total transfered
        require(
          strategicWallet.amountTransferred < strategicWallet.amountTransferredLimit,
          "Surpassed approved limit"
        );
      } else if (!isTransfer && fromIsCompanyLiquidityWallet && to != strategicWallet.approvedReceiver) {
        // Require unlocked company liquidity
        require(
          // solhint-disable-next-line not-rely-on-time
          block.timestamp >
            _companyLiquidityTransfersLockStartTime.add(_companyLiquidityTransfersLockPeriod),
          "Last max transfer too close"
        );
      } else if (!isTransfer) {
        require(
          (strategicWallet.approvedReceiver == to) ||
            (strategicWallet.approvedReceiver == _msgSender()),
          "Receiver not approved"
        );

        // "to" needs to be able to receive some non-zero amount from "from"
        require(
          strategicWallet.amountTransferred < strategicWallet.amountTransferredLimit,
          "Sender surpassed approved limit"
        );
      }
    }
    _;
  }

  /**
   * @dev Constructor, takes months of restriction for restriction offences.
   * Assumes _msgSender() is the company liquidity wallet.
   *
   * @param companyRestrictionWhitelistWallet The executive controlled restrictions lifter.
   * @param allocationsWallet The one strategic wallet.
   * @param crowdsalesWallet The second strategic wallet.
   * @param companyLiquidityTransferLimit Maximum accumulated transfers for company liquidity.
   * @param monthsOfRestrictionForTransfers Months of locked transfers for company liquidity wallet.
   */
  constructor(
    address companyRestrictionWhitelistWallet,
    address allocationsWallet,
    address crowdsalesWallet,
    uint32 companyLiquidityTransferLimit,
    uint16 monthsOfRestrictionForTransfers
  ) {
    _restrictionAdminWallet = companyRestrictionWhitelistWallet;

    _isStrategicWallet[_msgSender()] = true;
    _isStrategicWallet[allocationsWallet] = true;
    _isStrategicWallet[crowdsalesWallet] = true;

    _companyLiquidityWallet = _msgSender();
    _companyLiquidityTransfers = 0;
    _companyLiquidityTransfersLimit = SafeMath.mul(companyLiquidityTransferLimit, 10 ** 18);
    _companyLiquidityTransfersLockStartTime = 0;
    _companyLiquidityTransfersLockPeriod = SafeMath.mul(
      monthsOfRestrictionForTransfers,
      30 * 24 * 60 * 60
    );
  }

  function addUnrestrictedReceiver(
    address wallet,
    address receiver,
    uint256 amountLimit
  ) public virtual onlyRestrictionsAdmin {
    require(receiver != _restrictionAdminWallet, "Unrestrictor corruption guard");
    require(_isStrategicWallet[wallet], "Unrestricted wallet");

    StrategicWallet storage strategicWallet = _strategicWallet[wallet];
    require(
      (wallet == _companyLiquidityWallet) || (strategicWallet.approvedReceiver == address(0)),
      "Cannot set unrestricted"
    );

    strategicWallet.approvedReceiver = receiver;
    strategicWallet.amountTransferred = 0;
    strategicWallet.amountTransferredLimit = amountLimit;

    emit UnrestrictedReceiverAdded(wallet, receiver, amountLimit);
  }

  function removeUnrestrictedReceiver(address wallet) public virtual onlyRestrictionsAdmin {
    require(wallet == _companyLiquidityWallet, "Cannot remove allowance");

    StrategicWallet storage strategicWallet = _strategicWallet[wallet];

    strategicWallet.approvedReceiver = address(0);
    strategicWallet.amountTransferred = 0;
    strategicWallet.amountTransferredLimit = 0;

    emit UnrestrictedReceiverRemoved(wallet);
  }

  function isStrategicWallet(address wallet) public view returns (bool) {
    return _isStrategicWallet[wallet];
  }

  function getApprovedReceiver(address wallet) public view returns (address) {
    return _strategicWallet[wallet].approvedReceiver;
  }

  function getApprovedReceiverLimit(address wallet) public view returns (uint256) {
    return _strategicWallet[wallet].amountTransferredLimit;
  }

  function companyLiquidityTransfersLimit() public view returns (uint256) {
    return _companyLiquidityTransfersLimit;
  }

  function companyLiquidityTransfersSinceLastLimitReached() public view returns (uint256) {
    return _companyLiquidityTransfers;
  }

  function timeSinceCompanyLiquidityTransferLimitReached() public view returns (uint256) {
    // solhint-disable-next-line not-rely-on-time
    return block.timestamp - _companyLiquidityTransfersLockStartTime;
  }

  function companyLiquidityTransfersAreRestricted() public view returns (bool) {
    return
      // solhint-disable-next-line not-rely-on-time
      block.timestamp <
      _companyLiquidityTransfersLockStartTime.add(_companyLiquidityTransfersLockPeriod);
  }

  /**
   * @dev See {ERC20-_beforeTokenTransfer}.
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override withStrategicWalletRestriction(from, to, amount) {
    super._beforeTokenTransfer(from, to, amount);

    if (to != address(0) && _isStrategicWallet[from]) {
      bool isTransfer = from == _msgSender();
      bool fromIsCompanyLiquidityWallet = from == _companyLiquidityWallet;
      StrategicWallet storage strategicWallet = _strategicWallet[from];
      bool caseOne = !isTransfer &&
        (!fromIsCompanyLiquidityWallet || strategicWallet.approvedReceiver == to);
      bool caseTwo = isTransfer && strategicWallet.approvedReceiver == to;

      if (caseOne || caseTwo) {
        uint256 diff = strategicWallet.amountTransferredLimit.sub(
          strategicWallet.amountTransferred
        );

        if (amount < diff) {
          strategicWallet.amountTransferred += amount;
        } else {
          amount = diff;
          strategicWallet.amountTransferred += amount;

          emit StrategicWalletCapReached(from);
        }

        if (caseTwo && fromIsCompanyLiquidityWallet) {
          strategicWallet.approvedReceiver = address(0);
          strategicWallet.amountTransferred = 0;
          strategicWallet.amountTransferredLimit = 0;

          emit UnrestrictedTransferOccured(from, to, amount);
        }
      } else if (!caseTwo) {
        uint256 diff = _companyLiquidityTransfersLimit.sub(_companyLiquidityTransfers);
        if (amount < diff) {
          _companyLiquidityTransfers += amount;
        } else {
          amount = diff;

          emit StrategicWalletCapReached(from);

          // solhint-disable-next-line not-rely-on-time
          _companyLiquidityTransfersLockStartTime = block.timestamp;
          _companyLiquidityTransfers = 0;
        }
      }
    }
  }
}
