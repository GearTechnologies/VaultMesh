import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { DeadManSwitch } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DeadManSwitch", function () {
  let dms: DeadManSwitch;
  let owner: SignerWithAddress;
  let heir1: SignerWithAddress;
  let heir2: SignerWithAddress;
  let anyone: SignerWithAddress;

  const THIRTY_DAYS = 30 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, heir1, heir2, anyone] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DeadManSwitch");
    dms = await Factory.deploy(THIRTY_DAYS, [heir1.address, heir2.address]);
  });

  it("should initialise with correct interval and heirs", async function () {
    expect(await dms.checkInInterval()).to.equal(THIRTY_DAYS);
    expect(await dms.isTriggered()).to.be.false;
    const heirs = await dms.getHeirs();
    expect(heirs).to.deep.equal([heir1.address, heir2.address]);
  });

  it("checkIn should reset lastCheckIn timestamp", async function () {
    await time.increase(10 * 24 * 60 * 60); // 10 days
    const tx = await dms.connect(owner).checkIn();
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    expect(await dms.lastCheckIn()).to.equal(block!.timestamp);
  });

  it("checkIn should emit CheckIn event", async function () {
    await expect(dms.connect(owner).checkIn())
      .to.emit(dms, "CheckIn")
      .withArgs(owner.address, (v: bigint) => v > 0n);
  });

  it("triggerSwitch should revert before interval elapses", async function () {
    await time.increase(THIRTY_DAYS - 100);
    await expect(dms.connect(anyone).triggerSwitch()).to.be.revertedWith(
      "DMS: interval not elapsed"
    );
  });

  it("triggerSwitch should succeed after interval elapses", async function () {
    await time.increase(THIRTY_DAYS + 1);
    await expect(dms.connect(anyone).triggerSwitch())
      .to.emit(dms, "SwitchTriggered")
      .withArgs(owner.address, [heir1.address, heir2.address], (v: bigint) => v > 0n);
    expect(await dms.isTriggered()).to.be.true;
  });

  it("triggerSwitch should revert if already triggered", async function () {
    await time.increase(THIRTY_DAYS + 1);
    await dms.connect(anyone).triggerSwitch();
    await expect(dms.connect(anyone).triggerSwitch()).to.be.revertedWith(
      "DMS: already triggered"
    );
  });

  it("checkIn should revert after trigger", async function () {
    await time.increase(THIRTY_DAYS + 1);
    await dms.connect(anyone).triggerSwitch();
    await expect(dms.connect(owner).checkIn()).to.be.revertedWith(
      "DMS: already triggered"
    );
  });

  it("owner can updateHeirs", async function () {
    await dms.connect(owner).updateHeirs([anyone.address]);
    const heirs = await dms.getHeirs();
    expect(heirs).to.deep.equal([anyone.address]);
  });

  it("owner can updateInterval", async function () {
    const newInterval = 7 * 24 * 60 * 60;
    await dms.connect(owner).updateInterval(newInterval);
    expect(await dms.checkInInterval()).to.equal(newInterval);
  });

  it("non-owner cannot updateHeirs", async function () {
    await expect(
      dms.connect(anyone).updateHeirs([anyone.address])
    ).to.be.revertedWith("DMS: not owner");
  });
});
