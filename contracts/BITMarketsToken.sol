// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.14;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./token/ERC20Blacklistable.sol";
import "./token/ERC20Fees.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsToken is
  ERC20,
  ERC20Snapshot,
  ERC20Pausable,
  ERC20Burnable,
  ERC20Blacklistable,
  ERC20Fees,
  AccessControl
{
  using SafeMath for uint256;

  /**
   * @dev To keep track of last mint
   */
  uint256 private _lastMintTime;

  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
  bytes32 public constant ESG_FUND_ROLE = keccak256("ESG_FUND_ROLE");

  /**
   * @dev Reverts if less than 6 months since last mint.
   */
  modifier onlyAfter6Months() {
    require(block.timestamp - _lastMintTime >= 6 * 30 * 24 * 60 * 60 * 1000, "Last mint <6m");
    _;
  }

  /**
   * @dev Constructor
   * @param initialSupply The total number of tokens to mint without the decimals
   * @param companyRate The percentage of every transfer that goes back to company wallet (0-1000)
   * @param companyRewards The address that receives the transfer fees for the company
   * @param esgFundRate The percentage of every transfer that ends up in the ESG fund (0-1000)
   * @param esgFund The address that handles the ESG fund from gathered transfer fees
   * @param pauser The address with the authority to pause the ERC20 token
   *
   * address[] memory companyWallets,
   * uint16[] memory companyPercentages,
   * uint64 cliff,
   * uint64 vestingDuration
   */
  constructor(
    uint32 initialSupply,
    uint16 companyRate,
    address companyRewards,
    uint16 esgFundRate,
    address esgFund,
    address pauser
  )
    ERC20("BITMarketsToken", "BTMT")
    ERC20Blacklistable(100000)
    ERC20Fees(companyRate, esgFundRate, msg.sender, companyRewards, esgFund)
  {
    _mint(msg.sender, initialSupply * 10 ** decimals());

    // Setup roles
    _setupRole(MINTER_ROLE, msg.sender);
    _setupRole(ESG_FUND_ROLE, esgFund);
    _setupRole(PAUSER_ROLE, pauser);
    _setupRole(SNAPSHOT_ROLE, msg.sender);

    _lastMintTime = 0;
  }

  /**
   * @dev Takes snapshot of state and can return to it
   */
  function snapshot() public onlyRole(SNAPSHOT_ROLE) {
    _snapshot();
  }

  /**
   * @dev Freezes transfers, burning, minting
   */
  function pause() public onlyRole(PAUSER_ROLE) {
    _pause();
  }

  /**
   * @dev Unfreezes transfers, burning, minting
   */
  function unpause() public onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  /**
   * @dev Mints amount to address only if more than 6 months since and
   * only if totalSupply + 10% > amount
   */
  function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) onlyAfter6Months {
    require(totalSupply() + amount <= totalSupply().div(100).mul(111), "Mint >10% total supply");
    super._mint(to, amount);
  }

  /**
   * @dev Overridable function
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20, ERC20Snapshot, ERC20Pausable, ERC20Blacklistable, ERC20Fees) {
    super._beforeTokenTransfer(from, to, amount);
  }
}
