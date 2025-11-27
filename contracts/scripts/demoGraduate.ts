import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  console.log("🎓 Demo GRADUATION on", hre.network.name);

  const launchpadAddr = process.env.LAUNCHPAD_ADDRESS_AENEID;
  if (!launchpadAddr) {
    throw new Error("Missing LAUNCHPAD_ADDRESS_AENEID in .env");
  }

  const [owner] = await ethers.getSigners();
  console.log("👤 Owner (and trader):", owner.address);

  const lp = await ethers.getContractAt("SovryLaunchpad", launchpadAddr);

  const launched = await lp.getAllLaunchedTokens();
  if (launched.length === 0) {
    throw new Error("No launched tokens found on this launchpad");
  }
  const wrapper = launched[launched.length - 1];
  console.log("🎯 Using last launched wrapper:", wrapper);

  let tokenInfo = await lp.getTokenInfo(wrapper);
  let curve = await lp.getBondingCurve(wrapper);

  const marketCapBefore: any = await lp.getMarketCap(wrapper);
  console.log("📊 MarketCap before:", marketCapBefore.toString());

  // If marketCap is zero for some reason, set a small positive threshold
  const thresholdToSet = marketCapBefore.isZero()
    ? ethers.utils.parseEther("0.0001")
    : marketCapBefore;

  console.log("🔧 Updating graduationThreshold to:", thresholdToSet.toString());
  const txUpdate = await lp.connect(owner).updateGraduationThreshold(thresholdToSet);
  console.log("  updateGraduationThreshold tx:", txUpdate.hash);
  await txUpdate.wait();

  // Now perform a small BUY that should push marketCap above threshold
  const RT_UNIT = ethers.BigNumber.from("1000000"); // 1 RT worth of wrapper
  const buyAmount = RT_UNIT;

  const baseCost = await lp.calculateBuyPrice(wrapper, buyAmount);
  const totalFee = baseCost.div(100);
  const totalCost = baseCost.add(totalFee);

  console.log("💸 Graduation BUY cost:");
  console.log("  baseCost:", baseCost.toString());
  console.log("  totalFee (1%):", totalFee.toString());
  console.log("  totalCost:", totalCost.toString());

  console.log("🚀 Sending BUY tx to trigger graduation...");
  const deadline = Math.floor(Date.now() / 1000) + 600; // ~10 minutes from now
  const txBuy = await lp
    .connect(owner)
    .buy(wrapper, buyAmount, totalCost, deadline, { value: totalCost });
  console.log("  buy tx:", txBuy.hash);
  await txBuy.wait();

  tokenInfo = await lp.getTokenInfo(wrapper);
  curve = await lp.getBondingCurve(wrapper);

  const marketCapAfter: any = await lp.getMarketCap(wrapper);
  console.log("📊 MarketCap after:", marketCapAfter.toString());

  console.log("🎓 Graduation status:");
  console.log("  tokenInfo.graduated:", tokenInfo.graduated);
  console.log("  curve.isActive:", curve.isActive);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ demo-graduate-aeneid failed:", err);
    process.exit(1);
  });
