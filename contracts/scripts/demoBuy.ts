import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  console.log("🧪 Demo BUY on", hre.network.name);

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
  const priceBefore = await lp.getCurrentPrice(wrapper);

  console.log("📈 Curve before BUY:");
  console.log("  basePrice:", basePrice.toString());
  console.log("  priceIncrement:", priceIncrement.toString());
  console.log("  currentSupply:", currentSupplyBefore.toString());
  console.log("  reserveBalance:", reserveBefore.toString());
  console.log("  isActive:", isActive);
  console.log("  currentPrice:", priceBefore.toString());

  // Choose amount in RT units for the bonding curve, then convert to wrapper
  // units using WRAP_PER_RT (1 RT => 10,000,000 wrapper tokens).
  const RT_UNIT = ethers.BigNumber.from("1000000"); // 1 RT (6 decimals)
  const wrapPerRt = await lp.WRAP_PER_RT();

  const amountRt = RT_UNIT; // buy 1 whole RT from the curve
  const buyAmount = amountRt.mul(wrapPerRt); // wrapper units

  console.log("🚀 Buying:");
  console.log("  amountRt (RT units):", amountRt.toString());
  console.log("  wrapper amount:", buyAmount.toString());

  const baseCost = await lp.calculateBuyPrice(wrapper, buyAmount);
  const totalFee = baseCost.div(100); // 1%
  const totalCost = baseCost.add(totalFee);

  console.log("💸 Cost breakdown:");
  console.log("  baseCost:", baseCost.toString());
  console.log("  totalFee (1%):", totalFee.toString());
  console.log("  totalCost:", totalCost.toString());

  const treasuryBefore = await ethers.provider.getBalance(tokenInfo.creator); // temp, fix below
  const launchpadTreasury = await lp.treasury();
  const treasuryEthBefore = await ethers.provider.getBalance(launchpadTreasury);
  const creatorEthBefore = await ethers.provider.getBalance(tokenInfo.creator);

  console.log("🔁 Sending buy tx...");
  const deadline = Math.floor(Date.now() / 1000) + 600; // ~10 minutes from now
  const tx = await lp
    .connect(trader)
    .buy(wrapper, buyAmount, totalCost, deadline, { value: totalCost });
  console.log("  buy tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("  gasUsed:", receipt?.gasUsed.toString());

  const curveAfter = await lp.getBondingCurve(wrapper);
  const [_, __, currentSupplyAfter, reserveAfter] = curveAfter;
  const priceAfter = await lp.getCurrentPrice(wrapper);

  const SovryToken = await ethers.getContractFactory("SovryToken");
  const wrapperToken = SovryToken.attach(wrapper);
  const traderBalance = await wrapperToken.balanceOf(trader.address);

  const treasuryEthAfter = await ethers.provider.getBalance(launchpadTreasury);
  const creatorEthAfter = await ethers.provider.getBalance(tokenInfo.creator);

  console.log("📊 Curve after BUY:");
  console.log("  currentSupply:", currentSupplyAfter.toString());
  console.log("  reserveBalance:", reserveAfter.toString());
  console.log("  currentPrice:", priceAfter.toString());

  console.log("📦 Trader wrapper balance:", traderBalance.toString());

  const treasuryDelta = treasuryEthAfter.sub(treasuryEthBefore);
  const creatorDelta = creatorEthAfter.sub(creatorEthBefore);
  console.log("💰 Fee splits:");
  console.log("  treasuryDelta:", treasuryDelta.toString());
  console.log("  creatorDelta:", creatorDelta.toString());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ demo-buy-aeneid failed:", err);
    process.exit(1);
  });
