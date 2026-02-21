import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-ethers";

import { vars } from "hardhat/config";

const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY");
const DEPLOYER_PRIVATE_KEY = vars.get("DEPLOYER_PRIVATE_KEY");
const AMM_FORK_URL = vars.get("AMM_FORK_URL");

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
      {
        network: "kakarot_sepolia",
        chainId: 1802203764,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm",
          browserURL: "https://sepolia.kakarotscan.org",
        },
      },
      {
        network: "lisk-sepolia",
        chainId: 4202,
        urls: {
          apiURL: "https://sepolia-blockscout.lisk.com/api",
          browserURL: "https://sepolia-blockscout.lisk.com",
        },
      },
      {
        network: "lisk",
        chainId: 1135,
        urls: {
          apiURL: "https://blockscout.lisk.com/api",
          browserURL: "https://blockscout.lisk.com",
        },
      },
      {
        network: "arbitrum-sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io",
        },
      },
    ],
  },

  networks: {
    hardhat: {},
    amoy: {
      url: AMM_FORK_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 80002,
    },
    rootTest: {
      url: "https://public-node.testnet.rsk.co",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 31,
    },
    "lisk-sepolia": {
      url: "https://rpc.sepolia-api.lisk.com",
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 1000000000,
      chainId: 4202,
    },
    lisk: {
      url: "https://rpc.api.lisk.com",
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 1000000000,
      chainId: 1135,
    },
    "arbitrum-sepolia": {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 421614,
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 42161,
    },
  },

  mocha: {
    timeout: 1000000000000000,
  },
};

export default config;
