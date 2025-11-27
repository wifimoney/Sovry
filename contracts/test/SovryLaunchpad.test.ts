import { expect } from "chai";
import { ethers } from "hardhat";

describe("SovryLaunchpad", function () {
  // Fixture untuk deploy ulang state bersih sebelum setiap test
  async function deployLaunchpadFixture() {
    const [owner, creator, trader1, trader2, treasury] = await ethers.getSigners();

    // 1. Deploy Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wipToken = await MockERC20.deploy("Wrapped IP", "WIP"); // Native Token Mock
    const royaltyToken = await MockERC20.deploy("My Song Royalty", "RT-SONG");

    const MockPiperX = await ethers.getContractFactory("MockPiperXRouter");
    const piperXRouter = await MockPiperX.deploy();

    const MockRoyalty = await ethers.getContractFactory("MockRoyaltyWorkflows");
    const royaltyWorkflows = await MockRoyalty.deploy();
    
    // Danai MockRoyalty dengan ETH agar bisa simulasi bayar royalty
    await owner.sendTransaction({
      to: royaltyWorkflows.address,
      value: ethers.utils.parseEther("10.0")
    });

    // 2. Deploy Launchpad
    const SovryLaunchpad = await ethers.getContractFactory("SovryLaunchpad");
    const graduationThreshold = ethers.utils.parseEther("5.0"); // Set threshold rendah biar gampang test graduation
    
    const launchpad = await SovryLaunchpad.deploy(
      treasury.address,
      piperXRouter.address,
      royaltyWorkflows.address,
      wipToken.address,
      graduationThreshold,
      owner.address
    );

    return { 
      launchpad, 
      wipToken, 
      royaltyToken, 
      piperXRouter, 
      royaltyWorkflows, 
      owner, 
      creator, 
      trader1, 
      treasury,
      graduationThreshold 
    };
  }

  describe("Deployment", function () {
    it("Should set the correct treasury address", async function () {
      const { launchpad, treasury } = await deployLaunchpadFixture();
      expect(await launchpad.treasury()).to.equal(treasury.address);
    });
  });

  describe("Launching Token", function () {
    it("Should launch a new wrapper token correctly", async function () {
      const { launchpad, royaltyToken, creator } = await deployLaunchpadFixture();
      
      const amountToLock = ethers.BigNumber.from("1000"); // 1000 RT
      
      // Transfer RT ke Creator & Approve Launchpad
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);

      // Launch Parameter
      const basePrice = ethers.utils.parseEther("0.0001");
      const priceIncrement = ethers.utils.parseEther("0.00001");

      await expect(launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper Song",
        "W-SONG",
        basePrice,
        priceIncrement
      )).to.emit(launchpad, "TokenLaunched");

      // Verify Wrapper Created
      const launchedTokens = await launchpad.getAllLaunchedTokens();
      expect(launchedTokens.length).to.equal(1);

      const wrapperAddress = launchedTokens[0];

      // Check wrapper ownership is the launchpad
      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapperToken = SovryToken.attach(wrapperAddress);
      expect(await wrapperToken.owner()).to.equal(launchpad.address);

      const tokenInfo = await launchpad.getTokenInfo(wrapperAddress);
      const curve = await launchpad.getBondingCurve(wrapperAddress);

      // 75/20/5 rule: 1000 RT locked
      // - totalLocked = 1000
      expect(tokenInfo.totalLocked).to.equal(amountToLock);

      // - dexReserve = 20% = 200
      const dexReserve = tokenInfo.dexReserve;
      const expectedDexReserve = amountToLock.mul(20).div(100);
      expect(dexReserve).to.equal(expectedDexReserve);

      // - creator premine = 5% = 50
      const premine = amountToLock.mul(5).div(100);
      expect(await wrapperToken.balanceOf(creator.address)).to.equal(premine);

      // - currentSupply on curve = 75% = totalLocked - dexReserve - premine = 750
      const expectedCurveSupply = amountToLock.sub(dexReserve).sub(premine);
      const curveSupply = curve[2];
      expect(curveSupply).to.equal(expectedCurveSupply);

      // - initialCurveSupply used in pricing = totalLocked - dexReserve = 800
      const initialCurveSupply = tokenInfo.totalLocked.sub(tokenInfo.dexReserve);
      const expectedInitialCurveSupply = amountToLock.mul(80).div(100);
      expect(initialCurveSupply).to.equal(expectedInitialCurveSupply);

      // - wrapper totalSupply minted = 1000
      expect(await wrapperToken.totalSupply()).to.equal(amountToLock);
    });
  });

  describe("Trading (Bonding Curve)", function () {
    it("Should allow buying tokens and increase price", async function () {
      const { launchpad, royaltyToken, creator, trader1, treasury, owner } = await deployLaunchpadFixture();

      // Naikkan threshold supaya BUY tidak memicu graduation
      await launchpad
        .connect(owner)
        .updateGraduationThreshold(ethers.constants.MaxUint256);

      // --- Setup Launch ---
      const amountToLock = ethers.BigNumber.from("10000");
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper", "WRP",
        ethers.utils.parseEther("0.0001"), // Base Price
        ethers.utils.parseEther("0.00001") // Increment
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      // --- Test BUY with slippage protection and fee split ---
      const buyAmount = ethers.BigNumber.from("10");
      const baseCost = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const totalFee = baseCost.div(100); // 1% fee
      const totalCost = baseCost.add(totalFee);

      const priceBefore = await launchpad.getCurrentPrice(wrapperAddress);
      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

      const tx = await launchpad
        .connect(trader1)
        .buy(wrapperAddress, buyAmount, totalCost, { value: totalCost });
      const receipt = await tx.wait();
      if (receipt) {
        console.log("[Gas] buy gasUsed:", receipt.gasUsed.toString());
      }

      const priceAfter = await launchpad.getCurrentPrice(wrapperAddress);
      expect(priceAfter).to.be.greaterThan(priceBefore);

      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapperToken = SovryToken.attach(wrapperAddress);
      expect(await wrapperToken.balanceOf(trader1.address)).to.equal(buyAmount);

      const curve = await launchpad.getBondingCurve(wrapperAddress);
      const reserveBalance = curve[3];
      expect(reserveBalance).to.equal(baseCost);

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

      const expectedCreatorShare = totalFee.div(2); // 0.5%
      const expectedProtocolShare = totalFee.sub(expectedCreatorShare); // 0.5%

      const treasuryDelta = treasuryBalanceAfter.sub(treasuryBalanceBefore);
      const creatorDelta = creatorBalanceAfter.sub(creatorBalanceBefore);

      expect(treasuryDelta).to.equal(expectedProtocolShare);
      expect(creatorDelta).to.equal(expectedCreatorShare);

      // --- Slippage: require totalCost <= maxEthCost ---
      const smallAmount = ethers.BigNumber.from("1");
      const baseCost2 = await launchpad.calculateBuyPrice(wrapperAddress, smallAmount);
      const totalFee2 = baseCost2.div(100);
      const totalCost2 = baseCost2.add(totalFee2);
      const maxEthTooLow = totalCost2.sub(1);

      await expect(
        launchpad
          .connect(trader1)
          .buy(wrapperAddress, smallAmount, maxEthTooLow, { value: totalCost2 })
      ).to.be.revertedWith("Slippage: totalCost > maxEthCost");
    });

    it("Should allow selling tokens and decrease price", async function () {
      const { launchpad, royaltyToken, creator, trader1, owner } = await deployLaunchpadFixture();

      // Naikkan threshold supaya BUY/SELL tidak memicu graduation
      await launchpad
        .connect(owner)
        .updateGraduationThreshold(ethers.constants.MaxUint256);

      // --- Setup Launch ---
      const amountToLock = ethers.BigNumber.from("10000");
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper", "WRP",
        ethers.utils.parseEther("0.0001"), // Base Price
        ethers.utils.parseEther("0.00001") // Increment
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapperToken = SovryToken.attach(wrapperAddress);

      // Beli dulu supaya trader1 punya saldo
      const buyAmount = ethers.BigNumber.from("10");
      const baseBuyCost = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const buyFee = baseBuyCost.div(100);
      const buyTotalCost = baseBuyCost.add(buyFee);
      await launchpad
        .connect(trader1)
        .buy(wrapperAddress, buyAmount, buyTotalCost, { value: buyTotalCost });

      const priceBeforeSell = await launchpad.getCurrentPrice(wrapperAddress);
      const curveBeforeSell = await launchpad.getBondingCurve(wrapperAddress);
      const reserveBeforeSell = curveBeforeSell[3];

      // Jual sebagian
      const sellAmount = ethers.BigNumber.from("5");
      const baseProceeds = await launchpad.calculateSellPrice(wrapperAddress, sellAmount);
      const sellFee = baseProceeds.div(100);
      const netProceeds = baseProceeds.sub(sellFee);

      await wrapperToken.connect(trader1).approve(launchpad.address, sellAmount);

      await expect(
        launchpad.connect(trader1).sell(wrapperAddress, sellAmount, netProceeds)
      ).to.emit(launchpad, "TokensSold");

      const curveAfterSell = await launchpad.getBondingCurve(wrapperAddress);
      const reserveAfterSell = curveAfterSell[3];
      const reserveDelta = reserveBeforeSell.sub(reserveAfterSell);
      expect(reserveDelta).to.equal(baseProceeds);

      const priceAfterSell = await launchpad.getCurrentPrice(wrapperAddress);
      expect(priceAfterSell).to.be.lessThan(priceBeforeSell);

      const traderBalance = await wrapperToken.balanceOf(trader1.address);
      expect(traderBalance).to.equal(buyAmount - sellAmount);
    });

    it("Should revert sell when minEthProceeds is too high (slippage)", async function () {
      const { launchpad, royaltyToken, creator, trader1, owner } = await deployLaunchpadFixture();

      // Naikkan threshold supaya BUY/SELL tidak memicu graduation
      await launchpad
        .connect(owner)
        .updateGraduationThreshold(ethers.constants.MaxUint256);

      const amountToLock = ethers.BigNumber.from("10000");
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken
        .connect(creator)
        .approve(launchpad.address, amountToLock);

      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper",
        "WRP",
        ethers.utils.parseEther("0.0001"),
        ethers.utils.parseEther("0.00001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];
      const SovryToken = await ethers.getContractFactory("SovryToken");
      const wrapperToken = SovryToken.attach(wrapperAddress);

      const buyAmount = ethers.BigNumber.from("10");
      const baseBuyCost = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const buyFee = baseBuyCost.div(100);
      const buyTotalCost = baseBuyCost.add(buyFee);
      await launchpad
        .connect(trader1)
        .buy(wrapperAddress, buyAmount, buyTotalCost, { value: buyTotalCost });

      const sellAmount = ethers.BigNumber.from("5");
      const baseProceeds = await launchpad.calculateSellPrice(wrapperAddress, sellAmount);
      const sellFee = baseProceeds.div(100);
      const netProceeds = baseProceeds.sub(sellFee);
      const tooHighMinProceeds = netProceeds.add(1);

      await wrapperToken.connect(trader1).approve(launchpad.address, sellAmount);

      await expect(
        launchpad
          .connect(trader1)
          .sell(wrapperAddress, sellAmount, tooHighMinProceeds)
      ).to.be.revertedWith("Slippage: netProceeds < minEthProceeds");
    });

    it("Should graduate when threshold is reached", async function () {
      const { launchpad, royaltyToken, creator, trader1, graduationThreshold, piperXRouter } = await deployLaunchpadFixture();
      
      // --- Setup Launch ---
      const amountToLock = ethers.BigNumber.from("1000000"); // Banyak supply
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);
      
      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper", "WRP",
        ethers.utils.parseEther("0.001"), 
        ethers.utils.parseEther("0.0001")
      );
      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      // --- BUY UNTIL GRADUATION ---
      // Beli dalam jumlah besar yang melebihi graduationThreshold (5 ETH)
      const buyAmount = ethers.BigNumber.from("10"); 
      const baseCost = await launchpad.calculateBuyPrice(wrapperAddress, buyAmount);
      const totalFee = baseCost.div(100);
      const totalCost = baseCost.add(totalFee);
      
      await expect(
        launchpad
          .connect(trader1)
          .buy(wrapperAddress, buyAmount, totalCost, { value: totalCost })
      ).to.emit(launchpad, "Graduated");
      
      // Cek status graduation
      const tokenInfo = await launchpad.getTokenInfo(wrapperAddress);
      expect(tokenInfo.graduated).to.equal(true);

      // Cek curve sudah tidak aktif
      const curve = await launchpad.getBondingCurve(wrapperAddress);
      const isActive = curve[4];
      expect(isActive).to.equal(false);

      // Cek bahwa MockPiperXRouter dipanggil dengan likuiditas yang benar dan LP dikirim ke burn address
      const expectedTokenLiquidity = tokenInfo.dexReserve.add(curve[2]);
      const expectedNativeLiquidity = curve[3];

      const lastToken = await piperXRouter.lastToken();
      const lastAmountTokenDesired = await piperXRouter.lastAmountTokenDesired();
      const lastAmountETH = await piperXRouter.lastAmountETH();
      const lastTo = await piperXRouter.lastTo();

      expect(lastToken).to.equal(wrapperAddress);
      expect(lastAmountTokenDesired).to.equal(expectedTokenLiquidity);
      expect(lastAmountETH).to.equal(expectedNativeLiquidity);
      expect(lastTo).to.equal("0x000000000000000000000000000000000000dEaD");
    });

    it("Should harvest royalties and pump bonding curve reserve", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      // Naikkan graduationThreshold agar harvest saja tidak langsung memicu graduation
      await launchpad
        .connect(owner)
        .updateGraduationThreshold(ethers.utils.parseEther("1000000"));

      // --- Setup Launch ---
      const amountToLock = ethers.BigNumber.from("10000");
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken.connect(creator).approve(launchpad.address, amountToLock);

      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper", "WRP",
        ethers.utils.parseEther("0.0001"),
        ethers.utils.parseEther("0.00001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      const launchpadAddress = launchpad.address;

      // Snapshot sebelum pump
      const balanceBefore = await ethers.provider.getBalance(launchpadAddress);
      const curveBefore = await launchpad.getBondingCurve(wrapperAddress);
      const reserveBefore = curveBefore[3];
      const priceBefore = await launchpad.getCurrentPrice(wrapperAddress);

      console.log("[HarvestAndPump] Price before pump:", priceBefore.toString());

      // Panggil harvestAndPump (MockRoyaltyWorkflows akan mengirim 1 ETH)
      await expect(
        launchpad.harvestAndPump(
          wrapperAddress,
          "0x0000000000000000000000000000000000000001", // dummy ancestorIpId
          [],
          [],
          []
        )
      ).to.emit(launchpad, "RoyaltiesHarvested");

      const balanceAfter = await ethers.provider.getBalance(launchpadAddress);
      const curveAfter = await launchpad.getBondingCurve(wrapperAddress);
      const reserveAfter = curveAfter[3];
      const priceAfter = await launchpad.getCurrentPrice(wrapperAddress);

      console.log("[HarvestAndPump] Price after pump:", priceAfter.toString());

      // Launchpad menerima 1 ETH dari MockRoyaltyWorkflows
      const balanceDelta = balanceAfter.sub(balanceBefore);
      expect(balanceDelta).to.equal(ethers.utils.parseEther("1.0"));

      // reserveBalance di bonding curve bertambah sebesar jumlah klaim
      const reserveDelta = reserveAfter.sub(reserveBefore);
      expect(reserveDelta).to.equal(ethers.utils.parseEther("1.0"));

      // Pastikan harga tidak turun setelah pump (bisa tetap atau naik jika logika diubah)
      expect(priceAfter).to.be.greaterThanOrEqual(priceBefore);
    });
  });

  describe("Security: Emergency Withdraw", function () {
    it("Should revert when owner tries to emergencyWithdraw wrapper token", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const amountToLock = ethers.BigNumber.from("1000");
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken
        .connect(creator)
        .approve(launchpad.address, amountToLock);

      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper",
        "WRP",
        ethers.utils.parseEther("0.0001"),
        ethers.utils.parseEther("0.00001")
      );

      const launchedTokens = await launchpad.getAllLaunchedTokens();
      const wrapperAddress = launchedTokens[0];

      await expect(
        launchpad
          .connect(owner)
          .emergencyWithdraw(wrapperAddress, owner.address, 0)
      ).to.be.revertedWith("Cannot withdraw wrapper tokens");
    });

    it("Should revert when owner tries to emergencyWithdraw underlying RT vault tokens", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const amountToLock = ethers.BigNumber.from("1000");
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken
        .connect(creator)
        .approve(launchpad.address, amountToLock);

      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper",
        "WRP",
        ethers.utils.parseEther("0.0001"),
        ethers.utils.parseEther("0.00001")
      );

      await expect(
        launchpad
          .connect(owner)
          .emergencyWithdraw(royaltyToken.address, owner.address, 0)
      ).to.be.revertedWith("Cannot withdraw RT vault tokens");
    });

    it("Should revert withdrawing native liquidity while curves are active", async function () {
      const { launchpad, royaltyToken, creator, owner } = await deployLaunchpadFixture();

      const amountToLock = ethers.utils.parseUnits("1000", 18);
      await royaltyToken.transfer(creator.address, amountToLock);
      await royaltyToken
        .connect(creator)
        .approve(launchpad.address, amountToLock);

      await launchpad.connect(creator).launchToken(
        royaltyToken.address,
        amountToLock,
        "Wrapper",
        "WRP",
        ethers.utils.parseEther("0.0001"),
        ethers.utils.parseEther("0.00001")
      );

      await expect(
        launchpad
          .connect(owner)
          .emergencyWithdraw(ethers.constants.AddressZero, owner.address, 0)
      ).to.be.revertedWith("Cannot withdraw native liquidity while curves active");
    });
  });
});
