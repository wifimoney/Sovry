import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  console.log("🚀 Running prefunded RT launch on", hre.network.name);

  const launchpadAddr = process.env.LAUNCHPAD_ADDRESS_AENEID;
  const rtAddr = process.env.RT_ADDRESS_AENEID;

  if (!launchpadAddr || !rtAddr) {
    throw new Error(
      "Missing env vars: LAUNCHPAD_ADDRESS_AENEID and/or RT_ADDRESS_AENEID. Set them in contracts/.env"
    );
  }

  const [creator] = await ethers.getSigners();
  console.log("👤 Creator:", creator.address);

  const lp = await ethers.getContractAt("SovryLaunchpad", launchpadAddr);
  const rt = await ethers.getContractAt("IERC20", rtAddr);

  const rtDecimals = 6; // Story Royalty Tokens use 6 decimals
  const amountHuman = process.env.RT_AMOUNT_LOCK || "50"; // 50 RT by default
  const amountToLock = ethers.utils.parseUnits(amountHuman, rtDecimals);

  console.log("RT address:", rtAddr);
  console.log("Launchpad:", launchpadAddr);

  const balBefore = await rt.balanceOf(creator.address);
  console.log("RT balance before (raw):", balBefore.toString());

  // 1) Prefund launchpad with RT from creator wallet if needed
  const contractBalBefore = await rt.balanceOf(launchpadAddr);
  console.log("Launchpad RT balance before (raw):", contractBalBefore.toString());

  if (contractBalBefore.lt(amountToLock)) {
    const needed = amountToLock.sub(contractBalBefore);
    console.log("➡️  Transferring", amountHuman, "RT to launchpad...");
    const txPrefund = await rt.transfer(launchpadAddr, needed);
    console.log("  prefund tx:", txPrefund.hash);
    await txPrefund.wait();
  } else {
    console.log("Launchpad already has enough prefunded RT, skipping transfer.");
  }

  const contractBalAfter = await rt.balanceOf(launchpadAddr);
  console.log("Launchpad RT balance after (raw):", contractBalAfter.toString());

  // 2) Call launchTokenPrefunded
  const basePrice = ethers.utils.parseEther("0.00005");
  const priceIncrement = ethers.utils.parseEther("0.000005");

  const name = process.env.WRAPPER_NAME || "Your Wrapper Name";
  const symbol = process.env.WRAPPER_SYMBOL || "YWRP";

  console.log("📦 Calling launchTokenPrefunded...");
  const txLaunch = await lp.launchTokenPrefunded(
    rtAddr,
    amountToLock,
    name,
    symbol,
    basePrice,
    priceIncrement
  );
  console.log("  launch tx:", txLaunch.hash);
  await txLaunch.wait();

  const launched = await lp.getAllLaunchedTokens();
  const wrapper = launched[launched.length - 1];
  console.log("✅ Wrapper launched:", wrapper);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ launch-rt-prefunded-aeneid failed:", err);
    process.exit(1);
  });
