import { ethers, run } from "hardhat";

const WIP_ADDRESS = "0x1514000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer available");
  }

  console.log("Deploying contracts with:", deployer.address);

  const factory = await deployFactory(deployer.address);
  const router = await deployRouter(factory.address);

  await verifyContract("SovryFactory", factory.address, [WIP_ADDRESS, deployer.address, deployer.address, deployer.address]);
  await verifyContract("SovryRouter", router.address, [factory.address, WIP_ADDRESS]);

  console.log("Deployment complete.");
  console.log("Factory:", factory.address);
  console.log("Router:", router.address);
}

async function deployFactory(admin: string) {
  const SovryFactory = await ethers.getContractFactory("SovryFactory");
  const factory = await SovryFactory.deploy(WIP_ADDRESS, admin, admin, admin);
  await factory.deployed();
  console.log("SovryFactory deployed at", factory.address);
  return factory;
}

async function deployRouter(factoryAddress: string) {
  const SovryRouter = await ethers.getContractFactory("SovryRouter");
  const router = await SovryRouter.deploy(factoryAddress, WIP_ADDRESS);
  await router.deployed();
  console.log("SovryRouter deployed at", router.address);
  return router;
}

async function verifyContract(name: string, address: string, constructorArguments: unknown[]) {
  try {
    console.log(`Verifying ${name} at ${address}...`);
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`${name} verified successfully.`);
  } catch (error) {
    console.warn(`Verification skipped for ${name}:`, (error as Error).message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
