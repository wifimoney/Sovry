import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

const ZERO_BYTES32 = ethers.constants.HashZero;
const Q112 = BigNumber.from(2).pow(112);

async function increaseTime(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

async function deployMockToken(name: string, symbol: string) {
  const Token = await ethers.getContractFactory("MockERC20");
  const token = await Token.deploy(name, symbol);
  await token.deployed();
  return token;
}

async function setupFactory(wipAddress: string, admin: string) {
  const Factory = await ethers.getContractFactory("SovryFactory");
  const factory = await Factory.deploy(wipAddress, admin, admin, admin);
  await factory.deployed();
  return factory;
}

describe("Sovry Security Suite", function () {
  describe("Timelock Integration", function () {
    it("enforces scheduled fee updates via Timelock", async function () {
      const [deployer, other] = await ethers.getSigners();
      const wip = await deployMockToken("Wrapped IP", "WIP");
      const asset = await deployMockToken("Royalty", "ROY");
      const factory = await setupFactory(wip.address, deployer.address);

      await factory.createPair(asset.address, wip.address);
      const pairAddress = await factory.getPair(asset.address, wip.address);
      expect(ethers.utils.isAddress(pairAddress)).to.be.true;

      const Timelock = await ethers.getContractFactory("StoryTimelock");
      const minDelay = 3600;
      const timelock = await Timelock.deploy(minDelay, [deployer.address], [deployer.address], deployer.address);
      await timelock.deployed();

      const adminRole = await factory.DEFAULT_ADMIN_ROLE();
      const feeSetterRole = await factory.FEE_TO_SETTER_ROLE();

      await factory.grantRole(adminRole, timelock.address);
      await factory.grantRole(feeSetterRole, timelock.address);
      await factory.renounceRole(feeSetterRole, deployer.address);
      await factory.renounceRole(adminRole, deployer.address);

      await expect(factory.setFeeTo(other.address))
        .to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount")
        .withArgs(deployer.address, feeSetterRole);

      const data = factory.interface.encodeFunctionData("setFeeTo", [other.address]);
      const salt = ethers.utils.id("setFeeTo");

      await timelock.schedule(factory.address, 0, data, ZERO_BYTES32, salt, minDelay);
      await expect(
        timelock.execute(factory.address, 0, data, ZERO_BYTES32, salt)
      ).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");

      await increaseTime(minDelay);

      await timelock.execute(factory.address, 0, data, ZERO_BYTES32, salt);
      expect(await factory.feeTo()).to.equal(other.address);
    });
  });

  describe("Emergency Pause", function () {
    it("blocks swaps but allows liquidity withdrawal", async function () {
      const [deployer, guardian, trader] = await ethers.getSigners();
      const wip = await deployMockToken("Wrapped IP", "WIP");
      const asset = await deployMockToken("Royalty", "ROY");
      const factory = await setupFactory(wip.address, deployer.address);

      await wip.mint(deployer.address, ethers.utils.parseUnits("5000", 18));
      await asset.mint(deployer.address, ethers.utils.parseUnits("5000", 18));
      await wip.mint(trader.address, ethers.utils.parseUnits("500", 18));

      await factory.createPair(asset.address, wip.address);
      const pairAddress = await factory.getPair(asset.address, wip.address);
      const pool = await ethers.getContractAt("SovryPool", pairAddress);

      const liquidityAmount = ethers.utils.parseUnits("1000", 18);
      await wip.transfer(pairAddress, liquidityAmount);
      await asset.transfer(pairAddress, liquidityAmount);
      await pool.mint(deployer.address);

      const guardianRole = await pool.PAUSER_ROLE();
      await network.provider.send("hardhat_impersonateAccount", [factory.address]);
      await network.provider.send("hardhat_setBalance", [factory.address, "0x56BC75E2D63100000"]);
      const factorySigner = await ethers.getSigner(factory.address);
      await pool.connect(factorySigner).grantRole(guardianRole, guardian.address);
      await network.provider.send("hardhat_stopImpersonatingAccount", [factory.address]);

      await pool.connect(guardian).pause();

      const swapIn = ethers.utils.parseUnits("10", 18);
      const amountOut = swapIn.div(2);
      await wip.connect(trader).transfer(pairAddress, swapIn);
      await expect(pool.connect(trader).swap(0, amountOut, trader.address, "0x"))
        .to.be.revertedWithCustomError(pool, "EnforcedPause");

      const userLiquidity = await pool.balanceOf(deployer.address);
      await pool.connect(deployer).transfer(pairAddress, userLiquidity.div(2));
      await expect(pool.connect(deployer).burn(deployer.address)).to.not.be.reverted;
    });
  });

  describe("Flash Loan Resilience", function () {
    it("tracks TWAP via price cumulative sum", async function () {
      const [deployer, trader] = await ethers.getSigners();
      const wip = await deployMockToken("Wrapped IP", "WIP");
      const asset = await deployMockToken("Royalty", "ROY");
      const factory = await setupFactory(wip.address, deployer.address);

      await wip.mint(deployer.address, ethers.utils.parseUnits("5000", 18));
      await asset.mint(deployer.address, ethers.utils.parseUnits("5000", 18));
      await wip.mint(trader.address, ethers.utils.parseUnits("500", 18));

      await factory.createPair(asset.address, wip.address);
      const pairAddress = await factory.getPair(asset.address, wip.address);
      const pool = await ethers.getContractAt("SovryPool", pairAddress);

      const liquidityAmount = ethers.utils.parseUnits("1000", 18);
      await wip.transfer(pairAddress, liquidityAmount);
      await asset.transfer(pairAddress, liquidityAmount);
      await pool.mint(deployer.address);

      const [reserve0, reserve1, blockTimestampBefore] = await pool.getReserves();
      const priceBefore = await pool.price0CumulativeLast();
      const timeElapsed = 30;
      await increaseTime(timeElapsed);

      const amountIn = ethers.utils.parseUnits("5", 18);
      await wip.connect(trader).transfer(pairAddress, amountIn);
      const amountOut = getAmountOut(amountIn, reserve0, reserve1);
      await pool.connect(trader).swap(0, amountOut, trader.address, "0x");

      const priceAfter = await pool.price0CumulativeLast();
      const [, , blockTimestampAfter] = await pool.getReserves();
      const actualElapsed = blockTimestampAfter - blockTimestampBefore;
      const expectedIncrement = encodePrice(reserve0, reserve1).mul(actualElapsed);
      expect(priceAfter.sub(priceBefore)).to.equal(expectedIncrement);
    });
  });
});

function getAmountOut(amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber) {
  const amountInWithFee = amountIn.mul(997);
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  return numerator.div(denominator);
}

function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return reserve1.mul(Q112).div(reserve0);
}
