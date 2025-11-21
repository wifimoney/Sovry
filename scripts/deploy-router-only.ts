import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const ownerAddress = process.env.OWNER_ADDRESS;
  const factoryAddress = process.env.FACTORY_ADDRESS || process.env.UNISWAP_V2_FACTORY_ADDRESS;
  const WIP_ADDRESS = "0x1514000000000000000000000000000000000000";

  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  if (!ownerAddress) {
    throw new Error("OWNER_ADDRESS environment variable is not set");
  }

  if (!factoryAddress) {
    throw new Error("FACTORY_ADDRESS or UNISWAP_V2_FACTORY_ADDRESS environment variable is not set");
  }

  console.log("Deploying SovryRouter to Aeneid...");
  console.log("Network:", hre.network.name);
  console.log("Owner Address:", ownerAddress);
  console.log("Factory Address:", factoryAddress);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const SovryRouter = await ethers.getContractFactory("SovryRouter");
  const router = await SovryRouter.deploy(factoryAddress, WIP_ADDRESS, ownerAddress);

  console.log("Waiting for deployment confirmation...");
  await router.deployed();

  console.log("SovryRouter deployed to:", router.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
