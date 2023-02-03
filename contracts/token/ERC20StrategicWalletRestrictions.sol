// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";

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
  mapping(address => address) private _strategicWalletApprovedReceiver;
  mapping(address => uint256) private _strategicWalletApprovedReceiverAmountTransferred;
  mapping(address => uint256) private _strategicWalletApprovedReceiverAmountTransferredLimit;

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
      // This is an approval and not a transfer
      if (from != _msgSender()) {
        // "from" is not the company liquidity wallet so either "to" or msgSender needs to be approved
        if (from != _companyLiquidityWallet) {
          require(
            (_strategicWalletApprovedReceiver[from] == to) ||
              (_strategicWalletApprovedReceiver[from] == _msgSender()),
            "Receiver not approved"
          );

          // "to" needs to be able to receive some non-zero amount from "from"
          require(
            _strategicWalletApprovedReceiverAmountTransferred[from] <
              _strategicWalletApprovedReceiverAmountTransferredLimit[from],
            "Sender surpassed approved limit"
          );
        } else {
          // Require unlocked company liquidity
          require(
            block.timestamp >
              _companyLiquidityTransfersLockStartTime.add(_companyLiquidityTransfersLockPeriod),
            "Last max transfer too close"
          );
        }
      } else {
        // this is a transfer since from == _msgSender()
        if (_strategicWalletApprovedReceiver[_msgSender()] != to) {
          // If crowdsales or allocations wallets then this was a transfer to some wallet
          // that is not the approved smart contract.
          // Only company liquidity is allowed to send to unapproved addresses.
          require(_msgSender() == _companyLiquidityWallet, "Illegal transfer");

          // Require unlocked company liquidity
          require(
            block.timestamp >
              _companyLiquidityTransfersLockStartTime.add(_companyLiquidityTransfersLockPeriod),
            "Last max transfer too close"
          );
        } else {
          require(
            _strategicWalletApprovedReceiverAmountTransferred[_msgSender()] <
              _strategicWalletApprovedReceiverAmountTransferredLimit[_msgSender()],
            "Surpassed approved limit"
          );
        }
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
    require(
      (wallet == _companyLiquidityWallet) ||
        (_strategicWalletApprovedReceiver[wallet] == address(0)),
      "Cannot set unrestricted"
    );

    _strategicWalletApprovedReceiver[wallet] = receiver;
    _strategicWalletApprovedReceiverAmountTransferredLimit[wallet] = amountLimit;

    emit UnrestrictedReceiverAdded(wallet, receiver, amountLimit);
  }

  function removeUnrestrictedReceiver(address wallet) public virtual onlyRestrictionsAdmin {
    require(wallet == _companyLiquidityWallet, "Cannot remove allowance");

    _strategicWalletApprovedReceiver[wallet] = address(0);
    _strategicWalletApprovedReceiverAmountTransferredLimit[wallet] = 0;

    emit UnrestrictedReceiverRemoved(wallet);
  }

  function isStrategicWallet(address wallet) public view returns (bool) {
    return _isStrategicWallet[wallet];
  }

  function getApprovedReceiver(address wallet) public view returns (address) {
    return _strategicWalletApprovedReceiver[wallet];
  }

  function getApprovedReceiverLimit(address wallet) public view returns (uint256) {
    return _strategicWalletApprovedReceiverAmountTransferredLimit[wallet];
  }

  function companyLiquidityTransfersLimit() public view returns (uint256) {
    return _companyLiquidityTransfersLimit;
  }

  function companyLiquidityTransfersSinceLastLimitReached() public view returns (uint256) {
    return _companyLiquidityTransfers;
  }

  function timeSinceCompanyLiquidityTransferLimitReached() public view returns (uint256) {
    return block.timestamp - _companyLiquidityTransfersLockStartTime;
  }

  function companyLiquidityTransfersAreRestricted() public view returns (bool) {
    return
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
      if (from != _msgSender()) {
        // approval
        if (
          from != _companyLiquidityWallet ||
          (from == _companyLiquidityWallet && _strategicWalletApprovedReceiver[from] == to)
        ) {
          // either "to" or _msgSender approved
          uint256 diff = _strategicWalletApprovedReceiverAmountTransferredLimit[from].sub(
            _strategicWalletApprovedReceiverAmountTransferred[from]
          );

          if (amount < diff) {
            _strategicWalletApprovedReceiverAmountTransferred[from] += amount;
          } else {
            amount = diff;
            _strategicWalletApprovedReceiverAmountTransferred[from] += amount;

            emit StrategicWalletCapReached(from);
          }
        } else {
          // can approve to anybody within limits
          uint256 diff = _companyLiquidityTransfersLimit.sub(_companyLiquidityTransfers);
          if (amount < diff) {
            // Just add the amount to the transfers
            _companyLiquidityTransfers += amount;
          } else {
            // Reduce amount to what is allowed
            amount = diff;

            emit StrategicWalletCapReached(from);

            _companyLiquidityTransfersLockStartTime = block.timestamp;
            _companyLiquidityTransfers = 0;
          }
        }
      } else {
        // transfer (from == _msgSender())
        if (_strategicWalletApprovedReceiver[_msgSender()] != to) {
          // only company liquidity
          uint256 diff = _companyLiquidityTransfersLimit.sub(_companyLiquidityTransfers);
          if (amount < diff) {
            // Just add the amount to the transfers
            _companyLiquidityTransfers += amount;
          } else {
            // Reduce amount to what is allowed
            amount = diff;

            emit StrategicWalletCapReached(from);

            _companyLiquidityTransfersLockStartTime = block.timestamp;
            _companyLiquidityTransfers = 0;
          }
        } else {
          uint256 diff = _strategicWalletApprovedReceiverAmountTransferredLimit[from].sub(
            _strategicWalletApprovedReceiverAmountTransferred[from]
          );

          if (amount < diff) {
            _strategicWalletApprovedReceiverAmountTransferred[from] += amount;
          } else {
            amount = diff;
            _strategicWalletApprovedReceiverAmountTransferred[from] += amount;

            emit StrategicWalletCapReached(from);
          }

          if (_msgSender() == _companyLiquidityWallet) {
            // approval only for one transfer
            _strategicWalletApprovedReceiver[_msgSender()] = address(0);
            _strategicWalletApprovedReceiverAmountTransferred[_msgSender()] = 0;
            _strategicWalletApprovedReceiverAmountTransferredLimit[_msgSender()] = 0;

            emit UnrestrictedTransferOccured(from, to, amount);
          }
        }
      }
    }
  }
}
