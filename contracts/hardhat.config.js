require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // 🛡️ SECURITY: Fix stack too deep
    },
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    storyTestnet: {
      url: "https://aeneid.storyrpc.io",
      chainId: 1315,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1000000000, // 1 gwei
    }
  },
  etherscan: {
    apiKey: {
      storyTestnet: "your-api-key-here"
    },
    customChains: [
      {
        network: "storyTestnet",
        chainId: 1315,
        urls: {
          apiURL: "https://storyscan.io/api",
          browserURL: "https://storyscan.io"
        }
      }
    ]
  }
};
