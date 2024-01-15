const networkConfig={
    31337:{
        name:"localhost",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
        callbackGasLimit: "500000",
    },
    default:{
        name:"hardhat",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
    },
    11155111:{
        name:"sepolia",
        vrfCoordinatorAddress:"0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        subscriptionId:process.env.SUBSCRIPTION_ID,
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
        callbackGasLimit: "500000",
    }
}

const developmentChains = ["localhost","hardhat"]

module.exports = {networkConfig,developmentChains}