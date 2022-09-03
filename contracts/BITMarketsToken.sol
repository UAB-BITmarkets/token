// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/// @custom:security-contact security@bitmarkets.com
contract BITMarketsToken is ERC20, ERC20Burnable, ERC20Snapshot, ERC20Permit, Ownable, Pausable {
  constructor() ERC20("BITMarketsToken", "BTMX") ERC20Permit("BITMarketsToken") {
    // Mint 300 million tokens to owner
    _mint(msg.sender, 300000000 * 10**decimals());
  }

  function snapshot() public onlyOwner {
    _snapshot();
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  // function mint(address to, uint256 amount) public onlyOwner {
  //     require(totalSupply() + amount <= cap, "ERC20Capped: Mint will exceed total supply cap");
  //     super._mint(to, amount);
  // }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20, ERC20Snapshot) whenNotPaused {
    super._beforeTokenTransfer(from, to, amount);
  }
}
