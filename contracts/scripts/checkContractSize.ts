import { ethers } from "hardhat";

async function main() {
  console.log("Checking contract sizes...");
  
  // Get the SovryLaunchpad contract factory
  const SovryLaunchpad = await ethers.getContractFactory("SovryLaunchpad");
  
  // Get deployment bytecode
  const deploymentBytecode = SovryLaunchpad.bytecode;
  const size = deploymentBytecode.length / 2 - 1; // Convert hex length to bytes
  
  console.log(`SovryLaunchpad contract size: ${size} bytes`);
  console.log(`Ethereum mainnet limit: 24576 bytes`);
  console.log(`Status: ${size <= 24576 ? '✅ WITHIN LIMIT' : '❌ EXCEEDS LIMIT'}`);
  
  if (size > 24576) {
    const excess = size - 24576;
    console.log(`Exceeds limit by: ${excess} bytes`);
    console.log(`Percentage over limit: ${((excess / 24576) * 100).toFixed(2)}%`);
  }
  
  // Show optimization settings used
  console.log("\nOptimization settings:");
  console.log("- Optimizer enabled: true");
  console.log("- Runs: 50 (reduced from 200)");
  console.log("- viaIR: false (disabled for smaller bytecode)");
  console.log("- Custom errors: enabled (reduces gas and bytecode)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
