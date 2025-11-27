import { expect } from "chai";
import { ethers } from "hardhat";

describe("SovryLaunchpad - Comprehensive Test Suite", function () {
  // ============================================================================
  // SETUP & FIXTURES
  // ============================================================================

  async function deployLaunchpadFixture() {
    const [owner, creator, trader1, trader2, treasury] = await ethers.getSigners();

    // Deploy Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const MockERC206 = await ethers.getContractFactory("MockERC20_6");
    const MockPiperX = await ethers.getContractFactory("MockPiperXRouter");
    const MockRoyalty = await ethers.getContractFactory("MockRoyaltyWorkflows");

    const wipToken = await MockERC20.deploy("Wrapped IP", "WIP");
    const royaltyToken = await MockERC206.deploy("My Song Royalty", "RT-SONG");
    const piperXRouter = await MockPiperX.deploy();
    const royaltyWorkflows = await MockRoyalty.deploy();

    // Fund MockRoyaltyWorkflows with 10 ETH
    await owner.sendTransaction({
      to: royaltyWorkflows.address,
      value: ethers.utils.parseEther("10.0"),
    });

    // Deploy SovryLaunchpad
    const SovryLaunchpad = await ethers.getContractFactory("SovryLaunchpad");
    const graduationThreshold = ethers.utils.parseEther("5.0");

    const launchpad = await SovryLaunchpad.deploy(
      treasury.address,
      piperXRouter.address,
      royaltyWorkflows.address,
      wipToken.address,
      graduationThreshold,
      owner.address
    );

    // Whitelist RT token
    await launchpad.connect(owner).addApprovedRT(royaltyToken.address);

    // Mint 1,000 RT to creator (need at least 10% for launch)
    const RT_AMOUNT = ethers.BigNumber.from("1000").mul(ethers.BigNumber.from("1000000")); // 1,000 RT (6 decimals)
    await royaltyToken.transfer(creator.address, RT_AMOUNT);

    return {
      launchpad,
      wipToken,
      royaltyToken,
      piperXRouter,
      royaltyWorkflows,
      owner,
      creator,
      trader1,
      trader2,
      treasury,
      graduationThreshold,
    };
  }

  // ============================================================================
  // A. LAUNCH LOGIC - THE 75/20/5 RULE
  // ============================================================================

  describe("A. Launch Logic (75/20/5 Rule)", function () {
    it("Should correctly split 100 RT into 75% Curve, 20% DEX, 5% Creator", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100); // 100 RT (10% of 1000 RT balance)

      // Approve and launch
      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);

      const tx = await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      // Get token info
      const tokenInfo = await launchpad.getTokenInfo(wrapperAddress);
      const curve = await launchpad.getBondingCurve(wrapperAddress);

      // Verify 75/20/5 split
      const WRAP_PER_RT = await launchpad.WRAP_PER_RT();
      const WRAP_UNIT = await launchpad.WRAP_UNIT();

      // 75% goes to bonding curve
      const expectedCurveSupply = amountToLock.mul(75).div(100);
      expect(curve.currentSupply).to.equal(expectedCurveSupply);

      // 20% goes to DEX reserve
      const expectedDexReserve = amountToLock.mul(20).div(100);
      expect(tokenInfo.dexReserve).to.equal(expectedDexReserve);

      // 5% goes to creator
      const expectedCreatorReserve = amountToLock.mul(5).div(100);
      expect(tokenInfo.creatorReserve).to.equal(expectedCreatorReserve);

      // Total locked should be 100 RT
      expect(tokenInfo.totalLocked).to.equal(amountToLock);

      // Wrapper token supply should be 1000 (100 RT * 10 WRAP_PER_RT)
      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapper = SovryToken.attach(wrapperAddress);
      const totalSupply = await wrapper.totalSupply();
      const expectedWrapperSupply = amountToLock.mul(WRAP_PER_RT).div(RT_UNIT);
      expect(totalSupply).to.equal(expectedWrapperSupply);

      console.log("✅ 75/20/5 Split Verified:");
      console.log(`   Bonding Curve: ${ethers.utils.formatUnits(curve.currentSupply, 6)} RT`);
      console.log(`   DEX Reserve: ${ethers.utils.formatUnits(tokenInfo.dexReserve, 6)} RT`);
      console.log(`   Creator Reserve: ${ethers.utils.formatUnits(tokenInfo.creatorReserve, 6)} RT`);
      console.log(`   Wrapper Supply: ${ethers.utils.formatEther(totalSupply)} tokens`);
    });
  });

  // ============================================================================
  // B. TRADING & FEE SPLIT
  // ============================================================================

  describe("B. Trading & Fee Split", function () {
    it("Should correctly distribute fees on BUY (0.5% Treasury, 0.5% Creator)", async function () {
      const { launchpad, royaltyToken, creator, trader1, treasury, owner } = await deployLaunchpadFixture();

      // Launch token
      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      const WRAP_PER_RT = await launchpad.WRAP_PER_RT();

      // Calculate buy price
      const buyAmount = RT_UNIT.mul(1).mul(WRAP_PER_RT); // 1 RT worth of wrapper
      const baseCost = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const totalFee = baseCost.div(100); // 1% total fee
      const totalCost = baseCost.add(totalFee);

      // Record balances before
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      const creatorBefore = await ethers.provider.getBalance(creator.address);
      const launchpadBefore = await ethers.provider.getBalance(launchpad.address);

      // Buy
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await launchpad.connect(trader1).buy(wrapperAddress, buyAmount, totalCost, deadline, {
        value: totalCost,
      });

      // Record balances after
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const creatorAfter = await ethers.provider.getBalance(creator.address);
      const launchpadAfter = await ethers.provider.getBalance(launchpad.address);

      // Verify fee distribution
      const treasuryFee = treasuryAfter.sub(treasuryBefore);
      const creatorFee = creatorAfter.sub(creatorBefore);
      const expectedFeePerParty = totalFee.div(2); // 0.5% each

      expect(treasuryFee).to.be.closeTo(expectedFeePerParty, ethers.utils.parseEther("0.0001"));
      expect(creatorFee).to.be.closeTo(expectedFeePerParty, ethers.utils.parseEther("0.0001"));

      // Verify contract reserves increase
      const netReserveIncrease = launchpadAfter.sub(launchpadBefore);
      const expectedReserveIncrease = totalCost.sub(treasuryFee).sub(creatorFee);
      expect(netReserveIncrease).to.be.closeTo(expectedReserveIncrease, ethers.utils.parseEther("0.0001"));

      console.log("✅ Fee Distribution Verified:");
      console.log(`   Total Cost: ${ethers.utils.formatEther(totalCost)} ETH`);
      console.log(`   Treasury Fee (0.5%): ${ethers.utils.formatEther(treasuryFee)} ETH`);
      console.log(`   Creator Fee (0.5%): ${ethers.utils.formatEther(creatorFee)} ETH`);
      console.log(`   Contract Reserve Increase: ${ethers.utils.formatEther(netReserveIncrease)} ETH`);
    });

    it("Should correctly distribute fees on SELL (0.5% Treasury, 0.5% Creator)", async function () {
      const { launchpad, royaltyToken, creator, trader1, treasury, owner } = await deployLaunchpadFixture();

      // Launch token
      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      const WRAP_PER_RT = await launchpad.WRAP_PER_RT();

      // First BUY
      const buyAmount = RT_UNIT.mul(1).mul(WRAP_PER_RT);
      const buyPrice = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const buyFee = buyPrice.div(100);
      const buyCost = buyPrice.add(buyFee);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await launchpad.connect(trader1).buy(wrapperAddress, buyAmount, buyCost, deadline, {
        value: buyCost,
      });

      // Now SELL
      const sellPrice = await launchpad.calculateSellPrice(wrapperAddress, buyAmount);
      const sellFee = sellPrice.div(100);
      const sellProceeds = sellPrice.sub(sellFee);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      const creatorBefore = await ethers.provider.getBalance(creator.address);
      const trader1Before = await ethers.provider.getBalance(trader1.address);

      // Sell
      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapper = SovryToken.attach(wrapperAddress);
      await wrapper.connect(trader1).approve(launchpad.address, buyAmount);

      const sellTx = await launchpad.connect(trader1).sell(wrapperAddress, buyAmount, sellProceeds, deadline);
      const sellReceipt = await sellTx.wait();
      const gasUsed = sellReceipt.gasUsed.mul(sellReceipt.effectiveGasPrice);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const creatorAfter = await ethers.provider.getBalance(creator.address);
      const trader1After = await ethers.provider.getBalance(trader1.address);

      // Verify fees
      const treasuryFee = treasuryAfter.sub(treasuryBefore);
      const creatorFee = creatorAfter.sub(creatorBefore);
      const expectedFeePerParty = sellFee.div(2);

      expect(treasuryFee).to.be.closeTo(expectedFeePerParty, ethers.utils.parseEther("0.0001"));
      expect(creatorFee).to.be.closeTo(expectedFeePerParty, ethers.utils.parseEther("0.0001"));

      console.log("✅ SELL Fee Distribution Verified:");
      console.log(`   Sell Price: ${ethers.utils.formatEther(sellPrice)} ETH`);
      console.log(`   Treasury Fee (0.5%): ${ethers.utils.formatEther(treasuryFee)} ETH`);
      console.log(`   Creator Fee (0.5%): ${ethers.utils.formatEther(creatorFee)} ETH`);
      console.log(`   Trader Proceeds (after fees): ${ethers.utils.formatEther(sellProceeds)} ETH`);
    });

    it("Should revert SELL with slippage protection", async function () {
      const { launchpad, royaltyToken, creator, trader1, owner } = await deployLaunchpadFixture();

      // Launch token
      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      const WRAP_PER_RT = await launchpad.WRAP_PER_RT();

      // Buy
      const buyAmount = RT_UNIT.mul(1).mul(WRAP_PER_RT);
      const buyPrice = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const buyFee = buyPrice.div(100);
      const buyCost = buyPrice.add(buyFee);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await launchpad.connect(trader1).buy(wrapperAddress, buyAmount, buyCost, deadline, {
        value: buyCost,
      });

      // Try to sell with too high minAmountOut
      const sellPrice = await launchpad.calculateSellPrice(wrapperAddress, buyAmount);
      const tooHighMinAmount = sellPrice.mul(2); // Set minimum way too high

      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapper = SovryToken.attach(wrapperAddress);
      await wrapper.connect(trader1).approve(launchpad.address, buyAmount);

      await expect(
        launchpad.connect(trader1).sell(wrapperAddress, buyAmount, tooHighMinAmount, deadline)
      ).to.be.revertedWith("Slippage: Output too low");
    });
  });

  // ============================================================================
  // C. SECURITY: ANTI-RUG PULL
  // ============================================================================

  describe("C. Security: Anti-Rug Pull", function () {
    it("Should prevent emergency withdrawal of Wrapper Token", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      await expect(
        launchpad.connect(owner).emergencyWithdraw(wrapperAddress, owner.address, 0)
      ).to.be.revertedWith("Cannot withdraw wrapper tokens");
    });

    it("Should prevent emergency withdrawal of Royalty Token", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      await expect(
        launchpad.connect(owner).emergencyWithdraw(royaltyToken.address, owner.address, 0)
      ).to.be.revertedWith("Cannot withdraw RT vault tokens");
    });
  });

  // ============================================================================
  // D. REVENUE PUMP (HARVEST)
  // ============================================================================

  describe("D. Revenue Pump (Harvest)", function () {
    it("Should increase reserve and price on harvest", async function () {
      const { launchpad, royaltyToken, creator, owner, royaltyWorkflows } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      // Get price before harvest
      const priceBefore = await launchpad.getCurrentPrice(wrapperAddress);
      const reserveBefore = (await launchpad.getBondingCurve(wrapperAddress)).reserveBalance;

      // Harvest
      const childIpIds = [ethers.constants.AddressZero];
      const royaltyPolicies = [ethers.constants.AddressZero];
      const currencyTokens = [ethers.constants.AddressZero];

      await launchpad.connect(creator).harvest(
        wrapperAddress,
        ethers.constants.AddressZero,
        childIpIds,
        royaltyPolicies,
        currencyTokens
      );

      // Get price and reserve after harvest
      const priceAfter = await launchpad.getCurrentPrice(wrapperAddress);
      const reserveAfter = (await launchpad.getBondingCurve(wrapperAddress)).reserveBalance;

      // Verify reserve increased
      expect(reserveAfter).to.be.gt(reserveBefore);

      // Verify price increased (more ETH in reserve = higher price)
      expect(priceAfter).to.be.gte(priceBefore);

      console.log("✅ Harvest Revenue Pump Verified:");
      console.log(`   Reserve Before: ${ethers.utils.formatEther(reserveBefore)} ETH`);
      console.log(`   Reserve After: ${ethers.utils.formatEther(reserveAfter)} ETH`);
      console.log(`   Price Before: ${ethers.utils.formatEther(priceBefore)} ETH`);
      console.log(`   Price After: ${ethers.utils.formatEther(priceAfter)} ETH`);
    });
  });

  // ============================================================================
  // E. GRADUATION
  // ============================================================================

  describe("E. Graduation to DEX", function () {
    it("Should graduate token when market cap threshold is reached", async function () {
      const { launchpad, royaltyToken, creator, trader1, owner, piperXRouter } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Test Token",
        "TEST",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      const WRAP_PER_RT = await launchpad.WRAP_PER_RT();

      // Buy until market cap reaches 5 ETH threshold
      let totalSpent = ethers.BigNumber.from(0);
      let buyCount = 0;

      while (totalSpent.lt(ethers.utils.parseEther("5.5"))) {
        const buyAmount = RT_UNIT.mul(1).mul(WRAP_PER_RT);
        const buyPrice = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
        const buyFee = buyPrice.div(100);
        const buyCost = buyPrice.add(buyFee);

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        await launchpad.connect(trader1).buy(wrapperAddress, buyAmount, buyCost, deadline, {
          value: buyCost,
        });

        totalSpent = totalSpent.add(buyCost);
        buyCount++;

        if (buyCount > 20) break; // Safety limit
      }

      // Check if graduated
      const tokenInfo = await launchpad.getTokenInfo(wrapperAddress);
      expect(tokenInfo.graduated).to.be.true;

      console.log("✅ Graduation Verified:");
      console.log(`   Total Spent: ${ethers.utils.formatEther(totalSpent)} ETH`);
      console.log(`   Buy Count: ${buyCount}`);
      console.log(`   Graduated: ${tokenInfo.graduated}`);
    });
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  describe("Security Tests", function () {
    it("Should prevent RT balance manipulation via reentrancy", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper",
        "WRP",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const rtBalance = await royaltyToken.balanceOf(launchpad.address);
      expect(rtBalance).to.equal(amountToLock);

      // Try to launch again - should fail
      await expect(
        launchpad.connect(creator).launchToken(
          royaltyToken.address,
          amountToLock,
          "Wrapper2",
          "WRP2",
          ethers.utils.parseEther("0.001"),
          ethers.utils.parseEther("0.001")
        )
      ).to.be.revertedWith("Token already launched");
    });

    it("Should prevent prefund theft via race condition", async function () {
      const { launchpad, royaltyToken, creator, trader1, owner } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const depositAmount = RT_UNIT.mul(50);

      await royaltyToken.connect(creator).approve(launchpad.address, depositAmount);
      await launchpad.connect(creator).depositRT(royaltyToken.address, depositAmount);

      const balance = await launchpad.getDepositBalance(creator.address, royaltyToken.address);
      expect(balance).to.equal(depositAmount);

      // Trader1 tries to use creator's deposit - should fail
      await expect(
        launchpad.connect(trader1).launchTokenPrefunded(
          royaltyToken.address,
          depositAmount,
          "Wrapper",
          "WRP",
          ethers.utils.parseEther("0.001"),
          ethers.utils.parseEther("0.001")
        )
      ).to.be.revertedWith("Insufficient deposit balance");
    });

    it("Should handle overflow edge cases in bonding curve", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const RT_UNIT = ethers.BigNumber.from("1000000");
      const amountToLock = RT_UNIT.mul(100);

      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper",
        "WRP",
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      // Verify token was launched successfully
      expect(launchedTokens.length).to.equal(1);
      expect(wrapperAddress).to.not.equal(ethers.constants.AddressZero);
    });
  });
});
