import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { VMeshToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VMeshToken", function () {
  let token: VMeshToken;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let user: SignerWithAddress;

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const MAX_SUPPLY = ethers.parseEther("1000000000");

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VMeshToken");
    token = await Factory.deploy(owner.address);
  });

  it("should have correct name, symbol, decimals", async function () {
    expect(await token.name()).to.equal("VaultMesh Token");
    expect(await token.symbol()).to.equal("VMESH");
    expect(await token.decimals()).to.equal(18);
  });

  it("should have 1 billion max supply constant", async function () {
    expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
  });

  it("should allow owner to grant MINTER_ROLE", async function () {
    await token.connect(owner).grantRole(MINTER_ROLE, minter.address);
    expect(await token.hasRole(MINTER_ROLE, minter.address)).to.be.true;
  });

  it("should allow minter to mint tokens", async function () {
    await token.connect(owner).grantRole(MINTER_ROLE, minter.address);
    const amount = ethers.parseEther("1000");
    await token.connect(minter).mint(user.address, amount);
    expect(await token.balanceOf(user.address)).to.equal(amount);
  });

  it("should revert mint from non-minter", async function () {
    const amount = ethers.parseEther("1000");
    await expect(
      token.connect(user).mint(user.address, amount)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("should revert mint if max supply exceeded", async function () {
    await token.connect(owner).grantRole(MINTER_ROLE, minter.address);
    await expect(
      token.connect(minter).mint(user.address, MAX_SUPPLY + 1n)
    ).to.be.revertedWith("VMesh: max supply exceeded");
  });

  it("should pause and unpause transfers", async function () {
    await token.connect(owner).grantRole(MINTER_ROLE, owner.address);
    await token.connect(owner).mint(owner.address, ethers.parseEther("100"));
    await token.connect(owner).pause();
    await expect(
      token.connect(owner).transfer(user.address, ethers.parseEther("10"))
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
    await token.connect(owner).unpause();
    await token.connect(owner).transfer(user.address, ethers.parseEther("10"));
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("10"));
  });

  it("should revert pause from non-admin", async function () {
    await expect(
      token.connect(user).pause()
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("should support permit() (ERC-2612)", async function () {
    await token.connect(owner).grantRole(MINTER_ROLE, owner.address);
    await token.connect(owner).mint(owner.address, ethers.parseEther("100"));

    const nonce = await token.nonces(owner.address);
    const chainTime = await time.latest();
    const deadline = chainTime + 3600;
    const spender = user.address;
    const value = ethers.parseEther("50");

    const domain = {
      name: "VaultMesh Token",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await token.getAddress(),
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const permitData = { owner: owner.address, spender, value, nonce, deadline };
    const sig = await owner.signTypedData(domain, types, permitData);
    const { v, r, s } = ethers.Signature.from(sig);

    await token.permit(owner.address, spender, value, deadline, v, r, s);
    expect(await token.allowance(owner.address, spender)).to.equal(value);
  });
});
