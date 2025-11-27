import { ethers } from "hardhat";

async function main() {
  const routerAddr = process.env.PIPERX_ROUTER_AENEID!;
  const launchpadAddr = process.env.LAUNCHPAD_ADDRESS_AENEID!;
  const wrapper = "0x...wrapperTerakhir...";

  const routerAbi = [
    "function factory() view returns (address)",
    "function WETH() view returns (address)"
  ];
  const factoryAbi = [
    "function getPair(address tokenA, address tokenB) view returns (address)"
  ];

  const router = new ethers.Contract(routerAddr, routerAbi, ethers.provider);
  const factoryAddr = await router.factory();
  const weth = await router.WETH();

  const factory = new ethers.Contract(factoryAddr, factoryAbi, ethers.provider);
  const pair = await factory.getPair(wrapper, weth);

  console.log("Factory:", factoryAddr);
  console.log("WETH/WIP:", weth);
  console.log("Pair (wrapper-WIP):", pair);
}

main().catch(console.error);