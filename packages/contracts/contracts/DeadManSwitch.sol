// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DeadManSwitch
 * @notice Triggers release of heir key shares via a Lit Action if the owner
 *         fails to check in within the configured interval.
 */
contract DeadManSwitch {
    address public owner;
    uint256 public checkInInterval; // seconds
    uint256 public lastCheckIn;
    address[] public heirs;
    bool public triggered;

    /// @notice IPFS CID (as bytes32 hash) of the Lit Action that releases heir shares.
    bytes32 public litActionIpfsHash;

    event CheckIn(address indexed owner, uint256 timestamp);
    event SwitchTriggered(address indexed owner, address[] heirs, uint256 timestamp);
    event HeirsUpdated(address[] newHeirs);
    event IntervalUpdated(uint256 newInterval);
    event LitActionUpdated(bytes32 ipfsHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "DMS: not owner");
        _;
    }

    constructor(uint256 _checkInInterval, address[] memory _heirs) {
        owner = msg.sender;
        checkInInterval = _checkInInterval;
        heirs = _heirs; // empty array allowed on construction; heirs can be set later via updateHeirs
        lastCheckIn = block.timestamp;
    }

    /**
     * @notice Record a heartbeat. Resets the countdown.
     */
    function checkIn() external onlyOwner {
        require(!triggered, "DMS: already triggered");
        lastCheckIn = block.timestamp;
        emit CheckIn(msg.sender, block.timestamp);
    }

    /**
     * @notice Anyone can call this if the interval has elapsed.
     *         Emits SwitchTriggered; the off-chain Lit Action listens and releases shares.
     */
    function triggerSwitch() external {
        require(!triggered, "DMS: already triggered");
        require(
            block.timestamp > lastCheckIn + checkInInterval,
            "DMS: interval not elapsed"
        );
        triggered = true;
        emit SwitchTriggered(owner, heirs, block.timestamp);
    }

    /**
     * @notice View whether the switch has triggered.
     */
    function isTriggered() external view returns (bool) {
        return triggered;
    }

    /**
     * @notice Update the list of heirs. Only owner.
     */
    function updateHeirs(address[] memory newHeirs) external onlyOwner {
        require(newHeirs.length > 0, "DMS: no heirs");
        heirs = newHeirs;
        emit HeirsUpdated(newHeirs);
    }

    /**
     * @notice Update the check-in interval. Only owner.
     */
    function updateInterval(uint256 newInterval) external onlyOwner {
        require(newInterval > 0, "DMS: zero interval");
        checkInInterval = newInterval;
        emit IntervalUpdated(newInterval);
    }

    /**
     * @notice Set the IPFS hash of the Lit Action for tamper-evident reference.
     */
    function setLitActionIpfsHash(bytes32 ipfsHash) external onlyOwner {
        litActionIpfsHash = ipfsHash;
        emit LitActionUpdated(ipfsHash);
    }

    /**
     * @notice Return the current heirs array.
     */
    function getHeirs() external view returns (address[] memory) {
        return heirs;
    }
}
