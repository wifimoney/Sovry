import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  console.log("🧪 Demo SELL on", hre.network.name);

  const launchpadAddr = process.env.LAUNCHPAD_ADDRESS_AENEID;
  if (!launchpadAddr) {
    throw new Error("Missing LAUNCHPAD_ADDRESS_AENEID in .env");
  }

  const [trader] = await ethers.getSigners();
  console.log("👤 Trader:", trader.address);

  const lp = await ethers.getContractAt("SovryLaunchpad", launchpadAddr);

  const launched = await lp.getAllLaunchedTokens();
  if (launched.length === 0) {
    throw new Error("No launched tokens found on this launchpad");
  }
  const wrapper = launched[launched.length - 1];
  console.log("🎯 Using last launched wrapper:", wrapper);

  const tokenInfo = await lp.getTokenInfo(wrapper);
  console.log("  RT:", tokenInfo.rtAddress);
  console.log("  creator:", tokenInfo.creator);
  console.log("  totalLocked:", tokenInfo.totalLocked.toString());
  console.log("  dexReserve:", tokenInfo.dexReserve.toString());

  const curveBefore = await lp.getBondingCurve(wrapper);
  const [basePrice, priceIncrement, currentSupplyBefore, reserveBefore, isActive] = curveBefore;
  const priceBefore: any = await lp.getCurrentPrice(wrapper);

  console.log("📈 Curve before SELL:");
  console.log("  basePrice:", basePrice.toString());
  console.log("  priceIncrement:", priceIncrement.toString());
  console.log("  currentSupply:", currentSupplyBefore.toString());
  console.log("  reserveBalance:", reserveBefore.toString());
  console.log("  isActive:", isActive);
  console.log("  currentPrice:", priceBefore.toString());

  // RT_UNIT = 1e6, so 1 RT worth of wrapper = 1_000_000 units
  const RT_UNIT = ethers.BigNumber.from("1000000");

  const SovryToken = await ethers.getContractFactory("SovryToken");
  const wrapperToken = SovryToken.attach(wrapper);
  const traderBalance = await wrapperToken.balanceOf(trader.address);
  console.log("📦 Trader wrapper balance before:", traderBalance.toString());

  const wrapPerRt = await lp.WRAP_PER_RT();

  const sellRt = RT_UNIT;
  const sellAmount = sellRt.mul(wrapPerRt);

  if (traderBalance.lt(sellAmount)) {
    throw new Error("Trader does not have at least 1 RT worth of wrapper to sell");
  }

  console.log("🚀 Selling amount:", sellAmount.toString());

  const baseProceeds = await lp.calculateSellPrice(wrapper, sellAmount);
  const sellFee = baseProceeds.div(100); // 1%
  const netProceeds = baseProceeds.sub(sellFee);

  console.log("💸 Proceeds breakdown:");
  console.log("  baseProceeds:", baseProceeds.toString());
  console.log("  sellFee (1%):", sellFee.toString());
  console.log("  netProceeds:", netProceeds.toString());

  const launchpadTreasury = await lp.treasury();
  const treasuryEthBefore = await ethers.provider.getBalance(launchpadTreasury);
  const creatorEthBefore = await ethers.provider.getBalance(tokenInfo.creator);
  const traderEthBefore = await ethers.provider.getBalance(trader.address);

  console.log("🔁 Approving and sending sell tx...");
  const txApprove = await wrapperToken.connect(trader).approve(launchpadAddr, sellAmount);
  console.log("  approve tx:", txApprove.hash);
  await txApprove.wait();

  const deadline = Math.floor(Date.now() / 1000) + 600; // ~10 minutes from now

  const txSell = await lp
    .connect(trader)
    .sell(wrapper, sellAmount, netProceeds, deadline);
  console.log("  sell tx:", txSell.hash);
  const receipt = await txSell.wait();
  console.log("  gasUsed:", receipt?.gasUsed.toString());

  const curveAfter = await lp.getBondingCurve(wrapper);
  const [_, __, currentSupplyAfter, reserveAfter] = curveAfter;
  const priceAfter: any = await lp.getCurrentPrice(wrapper);

  const traderBalanceAfter = await wrapperToken.balanceOf(trader.address);
  const treasuryEthAfter = await ethers.provider.getBalance(launchpadTreasury);
  const creatorEthAfter = await ethers.provider.getBalance(tokenInfo.creator);
  const traderEthAfter = await ethers.provider.getBalance(trader.address);

  console.log("📊 Curve after SELL:");
  console.log("  currentSupply:", currentSupplyAfter.toString());
  console.log("  reserveBalance:", reserveAfter.toString());
  console.log("  currentPrice:", priceAfter.toString());

  console.log("📦 Trader wrapper balance after:", traderBalanceAfter.toString());

  const treasuryDelta = treasuryEthAfter.sub(treasuryEthBefore);
  const creatorDelta = creatorEthAfter.sub(creatorEthBefore);
  const traderDelta = traderEthAfter.sub(traderEthBefore);

  console.log("💰 Fee splits & trader delta:");
  console.log("  treasuryDelta:", treasuryDelta.toString());
  console.log("  creatorDelta:", creatorDelta.toString());
  console.log("  traderDelta (includes gas):", traderDelta.toString());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ demo-sell-aeneid failed:", err);
    process.exit(1);
  });
