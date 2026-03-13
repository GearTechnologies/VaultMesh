// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./VMeshToken.sol";

/**
 * @title RelayRewards
 * @notice Rewards relay node operators with $VMESH tokens per GB of bandwidth routed.
 * @dev sessionId must be signed by trusted oracleSigner to prevent spoofing.
 */
contract RelayRewards is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    VMeshToken public immutable vmeshToken;

    /// @notice Tokens minted per GB (1 GB = 1e9 bytes). Default: 10 VMESH per GB.
    uint256 public ratePerGB;

    /// @notice Address whose ECDSA signature authorises bandwidth reports.
    address public oracleSigner;

    /// @notice Tracks consumed session IDs to prevent replay attacks.
    mapping(bytes32 => bool) public usedSessions;

    event BandwidthRewarded(address indexed node, uint256 bytesRouted, uint256 tokens);
    event OracleSignerUpdated(address indexed newSigner);
    event RateUpdated(uint256 newRate);

    constructor(address _vmeshToken, address _oracleSigner, address initialOwner) Ownable(initialOwner) {
        vmeshToken = VMeshToken(_vmeshToken);
        oracleSigner = _oracleSigner;
        ratePerGB = 10 * 10 ** 18; // 10 VMESH per GB
    }

    /**
     * @notice Report bandwidth routed and receive $VMESH rewards.
     * @param sessionId   Unique session identifier (prevent replay).
     * @param bytesRouted Number of bytes routed during the session.
     * @param signature   ECDSA signature from oracleSigner over (node, sessionId, bytesRouted).
     */
    function reportBandwidth(
        bytes32 sessionId,
        uint256 bytesRouted,
        bytes calldata signature
    ) external {
        require(!usedSessions[sessionId], "RelayRewards: session already used");
        require(bytesRouted > 0, "RelayRewards: zero bytes");

        // Verify oracle signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, sessionId, bytesRouted));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        require(recovered == oracleSigner, "RelayRewards: invalid oracle signature");

        usedSessions[sessionId] = true;

        // Calculate tokens: bytesRouted / 1e9 * ratePerGB (no partial GB reward below 1 GB)
        uint256 tokensToMint = (bytesRouted * ratePerGB) / 1_000_000_000;
        if (tokensToMint == 0) {
            emit BandwidthRewarded(msg.sender, bytesRouted, 0);
            return;
        }

        vmeshToken.mint(msg.sender, tokensToMint);
        emit BandwidthRewarded(msg.sender, bytesRouted, tokensToMint);
    }

    /**
     * @notice Update the oracle signer address. Only owner.
     */
    function updateOracleSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "RelayRewards: zero address");
        oracleSigner = newSigner;
        emit OracleSignerUpdated(newSigner);
    }

    /**
     * @notice Update the reward rate per GB. Only owner.
     */
    function updateRate(uint256 newRate) external onlyOwner {
        ratePerGB = newRate;
        emit RateUpdated(newRate);
    }
}
