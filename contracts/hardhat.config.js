require("@nomicfoundation/hardhat-toolbox");
require("@tenderly/hardhat-tenderly");
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

const normalizePrivateKey = (key) => {
  if (!key) return undefined;
  return key.startsWith("0x") ? key : `0x${key}`;
};

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./",
    artifacts: "./artifacts",
    cache: "./cache",
  },
  networks: {
    hardhat: { chainId: 1337 },
    storyTestnet: {
      url: process.env.AENEID_RPC_URL,
      accounts: normalizePrivateKey(process.env.PRIVATE_KEY)
        ? [normalizePrivateKey(process.env.PRIVATE_KEY)]
        : [],
      chainId: 1315,
    },
  },
  tenderly: {
    username: process.env.TENDERLY_USERNAME,
    project: process.env.TENDERLY_PROJECT,
  },
};