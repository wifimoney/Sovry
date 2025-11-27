import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SovryToken", function () {
  async function deployWrapperFixture() {
    const [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const underlying = await MockERC20.deploy("Underlying", "UND");

    const SovryToken = await ethers.getContractFactory("SovryToken");
    const wrapper = await SovryToken.deploy(
      "Wrapper",
      "WRP",
      await underlying.getAddress(),
      owner.address
    );

    return { owner, user, underlying, wrapper };
  }

  it("should allow owner to mint and user to burn", async function () {
    const { owner, user, wrapper } = await loadFixture(deployWrapperFixture);

    const mintAmount = ethers.parseUnits("100", 18);
    await wrapper.connect(owner).mint(user.address, mintAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(mintAmount);

    const burnAmount = ethers.parseUnits("40", 18);
    await wrapper.connect(user).burn(burnAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(mintAmount - burnAmount);
  });

  it("should deposit and withdraw underlying 1:1", async function () {
    const { user, underlying, wrapper } = await loadFixture(deployWrapperFixture);

    const depositAmount = ethers.parseUnits("50", 18);

    // Mint underlying to user and approve wrapper
    await underlying.mint(user.address, depositAmount);
    await underlying.connect(user).approve(await wrapper.getAddress(), depositAmount);

    // Deposit underlying and receive wrapper tokens 1:1
    await wrapper.connect(user).deposit(depositAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(depositAmount);
    expect(await underlying.balanceOf(await wrapper.getAddress())).to.equal(depositAmount);

    // Withdraw back underlying by burning wrapper tokens
    await wrapper.connect(user).withdraw(depositAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(0n);
    expect(await underlying.balanceOf(await wrapper.getAddress())).to.equal(0n);
  });
});
