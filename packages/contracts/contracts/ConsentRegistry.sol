// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ConsentRegistry
 * @notice On-chain consent log for the VaultMesh data consent engine.
 */
contract ConsentRegistry {
    /// @notice Nested mapping: user → dataType → requester → allowed
    mapping(address => mapping(bytes32 => mapping(address => bool))) private _consents;

    event ConsentUpdated(
        address indexed user,
        bytes32 indexed dataType,
        address indexed requester,
        bool allowed
    );

    /**
     * @notice Set consent for a given data type and requester.
     * @param dataType  keccak256 hash of the data category label (e.g. "age_range").
     * @param requester Address of the data requester (advertiser).
     * @param allowed   Whether consent is granted.
     */
    function setConsent(bytes32 dataType, address requester, bool allowed) external {
        _consents[msg.sender][dataType][requester] = allowed;
        emit ConsentUpdated(msg.sender, dataType, requester, allowed);
    }

    /**
     * @notice Query whether a user has granted consent.
     * @param user      The user whose consent is queried.
     * @param dataType  The data category.
     * @param requester The requesting party.
     * @return bool     True if consent is granted.
     */
    function hasConsent(address user, bytes32 dataType, address requester) external view returns (bool) {
        return _consents[user][dataType][requester];
    }
}
