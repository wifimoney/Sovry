import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const AENEID_RPC_URL = process.env.AENEID_RPC_URL || "https://aeneid.storyrpc.io";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const OWNER_ADDRESS = process.env.OWNER_ADDRESS || "";
const STORYSCAN_API_KEY = process.env.STORYSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    // Treat this folder (./) as the Solidity sources directory so that
    // files like SovryLaunchpad.sol at the project root are compiled.
    sources: "./",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    aeneid: {
      url: AENEID_RPC_URL,
      chainId: 1315,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
    },
  },
  etherscan: {
    // For Storyscan, we treat it as an Etherscan-compatible custom chain
    apiKey: STORYSCAN_API_KEY,
    customChains: [
      {
        network: "aeneid",
        chainId: 1315,
        urls: {
          apiURL: "https://aeneid.storyscan.io/api",
          browserURL: "https://aeneid.storyscan.io",
        },
      },
    ],
  },
};

export default config;
