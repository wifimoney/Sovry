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

  // Deploy SovryFactory
  console.log("🏭 Deploying SovryFactory...");
  const SovryFactory = await ethers.getContractFactory("SovryFactory");
  const WIP_ADDRESS = "0x1514000000000000000000000000000000000000";
  const factory = await SovryFactory.deploy(WIP_ADDRESS, ownerAddress, ownerAddress, ownerAddress);
  
  console.log("⏳ Waiting for deployment confirmation...");
  await factory.deployed();
  
  const factoryAddress = factory.address;
  console.log("✅ SovryFactory deployed to:", factoryAddress);
  console.log("");

  // Deploy SovryRouter
  console.log("🔀 Deploying SovryRouter...");
  const SovryRouter = await ethers.getContractFactory("SovryRouter");
  const router = await SovryRouter.deploy(factoryAddress, WIP_ADDRESS);
  
  console.log("⏳ Waiting for deployment confirmation...");
  await router.deployed();
  
  const routerAddress = router.address;
  console.log("✅ SovryRouter deployed to:", routerAddress);
  console.log("");

  // Verify contracts (skip if SKIP_VERIFICATION is true)
  const skipVerification = process.env.SKIP_VERIFICATION === "true";
  
  if (!skipVerification) {
    console.log("🔍 Starting contract verification...");
    
    try {
      console.log("📋 Verifying SovryFactory...");
      await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [WIP_ADDRESS, ownerAddress, ownerAddress, ownerAddress],
        network: "aeneid"
      });
      console.log("✅ SovryFactory verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ SovryFactory already verified!");
      } else if (error.message.includes("not supported for contract verification")) {
        console.log("⚠️ Verification not supported on this network");
      } else {
        console.error("❌ SovryFactory verification failed:", error.message);
      }
    }

    try {
      console.log("📋 Verifying SovryRouter...");
      await hre.run("verify:verify", {
        address: routerAddress,
        constructorArguments: [factoryAddress, WIP_ADDRESS],
        network: "aeneid"
      });
      console.log("✅ SovryRouter verified successfully!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ SovryRouter already verified!");
      } else if (error.message.includes("not supported for contract verification")) {
        console.log("⚠️ Verification not supported on this network");
      } else {
        console.error("❌ SovryRouter verification failed:", error.message);
      }
    }
  } else {
    console.log("⏭️ Skipping contract verification (SKIP_VERIFICATION=true)");
  }

  console.log("");
  console.log("🎉 Deployment completed successfully!");
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("🏭 SovryFactory:", factoryAddress);
  console.log("🔀 SovryRouter:", routerAddress);
  console.log("");
  console.log("🌐 Explorer Links:");
  console.log(`🏭 Factory: https://storyscan.xyz/address/${factoryAddress}`);
  console.log(`🔀 Router: https://storyscan.xyz/address/${routerAddress}`);
  console.log("");
  
  // Save deployment info to environment file format
  const envContent = `
# Contract Addresses (Aeneid Testnet)
FACTORY_ADDRESS="${factoryAddress}"
ROUTER_ADDRESS="${routerAddress}"

# Deployment Info
DEPLOYER="${deployer.address}"
OWNER="${ownerAddress}"
NETWORK="aeneid"
TIMESTAMP="${new Date().toISOString()}"
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
