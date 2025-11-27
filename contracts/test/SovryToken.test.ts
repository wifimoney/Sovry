import { expect } from "chai";
import { ethers } from "hardhat";

describe("SovryToken", function () {
  async function deployWrapperFixture() {
    const [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const underlying = await MockERC20.deploy("Underlying", "UND");

    const SovryToken = await ethers.getContractFactory("SovryToken");
    const wrapper = await SovryToken.deploy(
      "Wrapper",
      "WRP",
      underlying.address,
      owner.address
    );

    return { owner, user, underlying, wrapper };
  }

  it("should allow owner to mint and user to burn", async function () {
    const { owner, user, wrapper } = await deployWrapperFixture();

    const mintAmount = ethers.utils.parseUnits("100", 18);
    await wrapper.connect(owner).mint(user.address, mintAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(mintAmount);

    const burnAmount = ethers.utils.parseUnits("40", 18);
    await wrapper.connect(user).burn(burnAmount);

    const expectedBalance = mintAmount.sub(burnAmount);
    expect(await wrapper.balanceOf(user.address)).to.equal(expectedBalance);
  });

  it("should deposit and withdraw underlying 1:1", async function () {
    const { user, underlying, wrapper } = await deployWrapperFixture();

    const depositAmount = ethers.utils.parseUnits("50", 18);

    // Mint underlying to user and approve wrapper
    await underlying.mint(user.address, depositAmount);
    await underlying.connect(user).approve(wrapper.address, depositAmount);

    // Deposit underlying and receive wrapper tokens 1:1
    await wrapper.connect(user).deposit(depositAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(depositAmount);
    expect(await underlying.balanceOf(wrapper.address)).to.equal(depositAmount);

    // Withdraw back underlying by burning wrapper tokens
    await wrapper.connect(user).withdraw(depositAmount);

    expect(await wrapper.balanceOf(user.address)).to.equal(ethers.constants.Zero);
    expect(await underlying.balanceOf(wrapper.address)).to.equal(ethers.constants.Zero);
  });
});
