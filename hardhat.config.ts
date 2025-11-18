import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "dotenv/config";

const AENEID_RPC_URL = process.env.AENEID_RPC_URL || "https://aeneid.storyrpc.io";
const AENEID_PRIVATE_KEY = process.env.AENEID_PRIVATE_KEY || "";

type ExtendedHardhatConfig = HardhatUserConfig & {
  etherscan?: {
    apiKey: string | { [network: string]: string };
  };
};

const config: ExtendedHardhatConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    aeneid: {
      url: AENEID_RPC_URL,
      chainId: 1315,
      accounts: AENEID_PRIVATE_KEY ? [AENEID_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.STORYSCAN_API_KEY || "",
  },
};

export default config;
