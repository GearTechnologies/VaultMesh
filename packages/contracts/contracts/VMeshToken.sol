// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VMeshToken
 * @notice ERC-20 $VMESH with minting role, pausable transfers, and ERC-2612 permit support.
 * @dev Max supply 1 billion tokens (1e27 raw). MINTER_ROLE granted to RelayRewards.
 */
contract VMeshToken is ERC20, ERC20Permit, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor(address initialOwner) ERC20("VaultMesh Token", "VMESH") ERC20Permit("VaultMesh Token") {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
    }

    /**
     * @notice Mint tokens. Only callable by MINTER_ROLE.
     * @param to Recipient address.
     * @param amount Amount to mint (18 decimals).
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "VMesh: max supply exceeded");
        _mint(to, amount);
    }

    /**
     * @notice Pause all token transfers. Only DEFAULT_ADMIN_ROLE.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause token transfers. Only DEFAULT_ADMIN_ROLE.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Required overrides for ERC20Pausable + AccessControl
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
