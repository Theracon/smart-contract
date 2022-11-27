require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const RINKEBY_RPC_URL = process.env.RINKEBY_RPC_URL || ""
const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY || ""
const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || ""
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY || ""
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || ""

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    rinkeby: {
      chainId: 4,
      url: RINKEBY_RPC_URL,
      accounts: [RINKEBY_PRIVATE_KEY],
      blockConfirmations: 6,
    },
    goerli: {
      chainId: 5,
      url: GOERLI_RPC_URL,
      accounts: [GOERLI_PRIVATE_KEY],
      blockConfirmations: 6,
    },
  },
  solidity: "0.8.8",
  namedAccounts: {
    deployer: { default: 0 },
    player: { default: 1 },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS_ENABLED !== undefined || true,
    noColors: process.env.REPORT_GAS_COLORED !== undefined || true,
    currency: "USD",
    outputFile: "gas-report.txt",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "ETH",
  },
  mocha: {
    timeout: 600000,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
}
