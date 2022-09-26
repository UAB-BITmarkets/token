// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/security/Pausable.sol";

import "./token/ERC20Blacklistable.sol";
import "./token/ERC20Fees.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsToken is
  ERC20,
  ERC20Snapshot,
  ERC20Pausable,
  ERC20Blacklistable,
  ERC20Fees,
  AccessControl
{
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
  bytes32 public constant ESG_FUND_ROLE = keccak256("ESG_FUND_ROLE");

  //TODO Do we need separate wallet for buyback?

  /**
   * @dev Constructor
   * @param initialSupply The total number of tokens to mint without the decimals
   * @param finalSupply The final number of tokens after deflation without the decimals
   * @param burnRate The percentage of every transfer to burn until final supply (0-1000)
   * @param buyBackRate The percentage of every transfer that goes back to company wallet (0-1000)
   * @param fundRate The percentage of every transfer that ends up in the ESG fund (0-1000)
   * @param fund The address that handles the ESG fund from gathered transfer fees
   * @param pauser The address with the authority to pause the ERC20 token
   */
  constructor(
    uint32 initialSupply,
    uint32 finalSupply,
    uint16 burnRate,
    uint16 buyBackRate,
    uint16 fundRate,
    address fund,
    address pauser
  )
    ERC20("BITMarketsToken", "BTMX")
    ERC20Blacklistable(1000000)
    ERC20Fees(finalSupply, burnRate, buyBackRate, fundRate, msg.sender, fund)
  {
    _mint(msg.sender, initialSupply * 10**decimals());

    // Setup roles
    _setupRole(ESG_FUND_ROLE, fund);
    _setupRole(PAUSER_ROLE, pauser);
    _setupRole(SNAPSHOT_ROLE, msg.sender);
  }

  function snapshot() public onlyRole(SNAPSHOT_ROLE) {
    _snapshot();
  }

  function pause() public onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  // function burn(address from, uint256 amount) public whenNotPaused onlyRole(BURNER_ROLE) {
  //   _burn(from, amount);
  // }

  // function mint(address to, uint256 amount) public onlyOwner {
  //     require(totalSupply() + amount <= cap, "ERC20Capped: Mint will exceed total supply cap");
  //     super._mint(to, amount);
  // }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20, ERC20Snapshot, ERC20Pausable, ERC20Blacklistable, ERC20Fees) {
    super._beforeTokenTransfer(from, to, amount);
  }

  // function _afterTokenTransfer(
  //   address from,
  //   address to,
  //   uint256 amount
  // ) internal override(ERC20, ERC20Fees) whenNotPaused {
  //   super._afterTokenTransfer(from, to, amount);
  // }
}
