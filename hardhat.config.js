require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy")
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require('solidity-coverage')
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers:[{version:"0.8.12"},{version:"0.8.4"}]
  },
  namedAccounts:{
    deployer:{
      default:0
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    ganache:{
      url:"http://127.0.0.1:7545",
      accounts:["0xd7f67da7f7ed53601e314f6c7aceb2c1e0ded78d489997cb833e574296050210"],
      chainId:1337
    },
    localhost:{
      url:"http://127.0.0.1:8545/",
      //accounts:taken care by hardhat
      chainId:31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 11155111,
      blockConfirmations: 6,  // not needed
    },
  },
  mocha:{
    timeout:200000 //200s
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
