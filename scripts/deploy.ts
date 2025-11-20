import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Get environment variables
  const privateKey = process.env.PRIVATE_KEY;
  const ownerAddress = process.env.OWNER_ADDRESS;

  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  if (!ownerAddress) {
    throw new Error("OWNER_ADDRESS environment variable is not set");
  }

  
  console.log("🚀 Starting deployment to Aeneid Testnet...");
  console.log("📍 Network:", hre.network.name);
  console.log("👤 Owner Address:", ownerAddress);
  console.log("🔗 Deployer Address:", new ethers.Wallet(privateKey).address);
  console.log("");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📦 Deploying contracts with account:", deployer.address);
  
  // Check deployer balance
  if (!deployer.provider) {
    throw new Error("Deployer provider is not available");
  }
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "IP");
  console.log("");

  // Deploy SECURE SovryFactory
  console.log("🏭 Deploying SECURE SovryFactory...");
  const SovryFactory = await ethers.getContractFactory("SovryFactory");
  const WIP_ADDRESS = "0x1514000000000000000000000000000000000000";
  const factory = await SovryFactory.deploy(WIP_ADDRESS, ownerAddress, ownerAddress, ownerAddress);
  
  console.log("⏳ Waiting for deployment confirmation...");
  await factory.deployed();
  
  const factoryAddress = factory.address;
  console.log("✅ FIXED SovryFactory deployed to:", factoryAddress);
  console.log("");

  // Deploy SECURE SovryRouter
  console.log("🔀 Deploying SECURE SovryRouter to secure factory...");
  const SovryRouter = await ethers.getContractFactory("SovryRouter");
  const router = await SovryRouter.deploy(factoryAddress, WIP_ADDRESS, ownerAddress);
  
  console.log("⏳ Waiting for deployment confirmation...");
  await router.deployed();
  
  const routerAddress = router.address;
  console.log("✅ FIXED SovryRouter deployed to:", routerAddress);
  console.log("");

  // Deploy FIXED SovryPool (for new pools)
  console.log("🏊 Deploying FIXED SovryPool...");
  const SovryPool = await ethers.getContractFactory("SovryPool");
  const pool = await SovryPool.deploy();
  
  console.log("⏳ Waiting for deployment confirmation...");
  await pool.deployed();
  
  const poolAddress = pool.address;
  console.log("✅ FIXED SovryPool deployed to:", poolAddress);
  console.log("");

  // Verify contracts (skip if SKIP_VERIFICATION is true)
  const skipVerification = process.env.SKIP_VERIFICATION === "true";
  
  if (!skipVerification) {
    console.log("🔍 Starting contract verification...");
    
    try {
      console.log("📋 Verifying FIXED SovryRouter...");
      await hre.run("verify:verify", {
        address: routerAddress,
        constructorArguments: [factoryAddress, WIP_ADDRESS],
        network: "aeneid"
      });
      console.log("✅ FIXED SovryRouter verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ FIXED SovryRouter already verified!");
      } else if (error.message.includes("not supported for contract verification")) {
        console.log("⚠️ Verification not supported on this network");
      } else {
        console.error("❌ FIXED SovryRouter verification failed:", error.message);
      }
    }
  } else {
    console.log("⏭️ Skipping contract verification (SKIP_VERIFICATION=true)");
  }

  console.log("");
  console.log("🎉 Deployment completed successfully!");
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("🏭 SovryFactory (Existing):", factoryAddress);
  console.log("🔀 FIXED SovryRouter:", routerAddress);
  console.log("🏊 FIXED SovryPool:", poolAddress);
  console.log("");
  console.log("🌐 Explorer Links:");
  console.log(`🏭 Factory: https://storyscan.xyz/address/${factoryAddress}`);
  console.log(`🔀 FIXED Router: https://storyscan.xyz/address/${routerAddress}`);
  console.log(`🏊 FIXED Pool: https://storyscan.xyz/address/${poolAddress}`);
  console.log("");
  
  // Save deployment info to environment file format
  const envContent = `
# FIXED Contract Addresses (Aeneid Testnet)
SOVRY_ROUTER_ADDRESS="${routerAddress}"
NEXT_PUBLIC_ROUTER_ADDRESS="${routerAddress}"
SOVRY_POOL_ADDRESS="${poolAddress}"

# Existing Factory
FACTORY_ADDRESS="${factoryAddress}"

# Deployment Info
DEPLOYER="${deployer.address}"
OWNER="${ownerAddress}"
NETWORK="aeneid"
TIMESTAMP="${new Date().toISOString()}"
FIXED_CONTRACTS_DEPLOYED="true"
`;
  
  console.log("📝 Environment variables for .env file:");
  console.log(envContent);
  
  // Also save to a deployment file
  const fs = require("fs");
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: 1315,
    deployer: deployer.address,
    owner: ownerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      SovryFactory: {
        address: factoryAddress,
        transactionHash: factory.deployTransaction?.hash || "unknown",
      },
      SovryRouter: {
        address: routerAddress,
        transactionHash: router.deployTransaction?.hash || "unknown",
      },
    },
  };
  
  fs.writeFileSync(
    `deployments/${hre.network.name}-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`💾 Deployment info saved to deployments/${hre.network.name}-${Date.now()}.json`);
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
