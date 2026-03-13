import { expect } from "chai";
import { ethers } from "hardhat";
import { VMeshToken, RelayRewards } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RelayRewards", function () {
  let token: VMeshToken;
  let rewards: RelayRewards;
  let owner: SignerWithAddress;
  let oracle: SignerWithAddress;
  let node: SignerWithAddress;
  let other: SignerWithAddress;

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const ONE_GB = 1_000_000_000n;

  async function signSession(
    nodeAddress: string,
    sessionId: string,
    bytesRouted: bigint,
    signer: SignerWithAddress
  ): Promise<string> {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "bytes32", "uint256"],
        [nodeAddress, sessionId, bytesRouted]
      )
    );
    return signer.signMessage(ethers.getBytes(hash));
  }

  beforeEach(async function () {
    [owner, oracle, node, other] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("VMeshToken");
    token = await TokenFactory.deploy(owner.address);

    const RewardsFactory = await ethers.getContractFactory("RelayRewards");
    rewards = await RewardsFactory.deploy(
      await token.getAddress(),
      oracle.address,
      owner.address
    );

    await token.connect(owner).grantRole(MINTER_ROLE, await rewards.getAddress());
  });

  it("should mint correct tokens for 1 GB", async function () {
    const sessionId = ethers.keccak256(ethers.toUtf8Bytes("session-1"));
    const bytesRouted = ONE_GB;
    const sig = await signSession(node.address, sessionId, bytesRouted, oracle);

    await expect(
      rewards.connect(node).reportBandwidth(sessionId, bytesRouted, sig)
    )
      .to.emit(rewards, "BandwidthRewarded")
      .withArgs(node.address, bytesRouted, ethers.parseEther("10"));

    expect(await token.balanceOf(node.address)).to.equal(ethers.parseEther("10"));
  });

  it("should mint proportional tokens for 2.5 GB", async function () {
    const sessionId = ethers.keccak256(ethers.toUtf8Bytes("session-2"));
    const bytesRouted = 2_500_000_000n;
    const sig = await signSession(node.address, sessionId, bytesRouted, oracle);

    await rewards.connect(node).reportBandwidth(sessionId, bytesRouted, sig);
    expect(await token.balanceOf(node.address)).to.equal(ethers.parseEther("25"));
  });

  it("should revert with invalid oracle signature", async function () {
    const sessionId = ethers.keccak256(ethers.toUtf8Bytes("session-3"));
    const bytesRouted = ONE_GB;
    const badSig = await signSession(node.address, sessionId, bytesRouted, other);

    await expect(
      rewards.connect(node).reportBandwidth(sessionId, bytesRouted, badSig)
    ).to.be.revertedWith("RelayRewards: invalid oracle signature");
  });

  it("should revert on replayed sessionId", async function () {
    const sessionId = ethers.keccak256(ethers.toUtf8Bytes("session-4"));
    const bytesRouted = ONE_GB;
    const sig = await signSession(node.address, sessionId, bytesRouted, oracle);

    await rewards.connect(node).reportBandwidth(sessionId, bytesRouted, sig);

    // Re-sign because same params, same sig — just replay
    await expect(
      rewards.connect(node).reportBandwidth(sessionId, bytesRouted, sig)
    ).to.be.revertedWith("RelayRewards: session already used");
  });

  it("should allow owner to update oracle signer", async function () {
    await rewards.connect(owner).updateOracleSigner(other.address);
    expect(await rewards.oracleSigner()).to.equal(other.address);
  });

  it("should allow owner to update rate", async function () {
    const newRate = ethers.parseEther("20");
    await rewards.connect(owner).updateRate(newRate);
    expect(await rewards.ratePerGB()).to.equal(newRate);
  });

  it("should revert updateOracleSigner from non-owner", async function () {
    await expect(
      rewards.connect(other).updateOracleSigner(other.address)
    ).to.be.revertedWithCustomError(rewards, "OwnableUnauthorizedAccount");
  });
});
