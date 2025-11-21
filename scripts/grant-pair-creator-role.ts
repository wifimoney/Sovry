import { ethers } from "hardhat";

async function main() {
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || process.env.UNISWAP_V2_FACTORY_ADDRESS;
  const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || process.env.UNISWAP_V2_ROUTER_ADDRESS || "0xD711896DCD894CB3dECAdF79e8522bf660b23960";

  if (!FACTORY_ADDRESS) {
    throw new Error("FACTORY_ADDRESS or UNISWAP_V2_FACTORY_ADDRESS env var is not set");
  }

  if (!ROUTER_ADDRESS) {
    throw new Error("ROUTER_ADDRESS or UNISWAP_V2_ROUTER_ADDRESS env var is not set");
  }

  console.log("Using SovryFactory at:", FACTORY_ADDRESS);
  console.log("Granting PAIR_CREATOR_ROLE to router:", ROUTER_ADDRESS);

  const factory = await ethers.getContractAt("SovryFactory", FACTORY_ADDRESS);

  const PAIR_CREATOR_ROLE = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PAIR_CREATOR_ROLE")
  );

  console.log("PAIR_CREATOR_ROLE hash:", PAIR_CREATOR_ROLE);

  const tx = await factory.grantRole(PAIR_CREATOR_ROLE, ROUTER_ADDRESS);
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  console.log("✅ PAIR_CREATOR_ROLE granted to router successfully");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
