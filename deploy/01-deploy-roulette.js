const { ethers, network } = require("hardhat");
const {developmentChains,networkConfig} = require("../helper-hardhat-config")
const {verify} = require("../utils/verify")

const minEthBalance = ethers.parseEther("0.01")
const maxEthBalance = ethers.parseEther("0.1")
const straightUpBetsValue = ethers.parseEther("0.0005") 
const outsideBetsValue = ethers.parseEther("0.0025")

//for mocks
const FUND_AMOUNT = ethers.parseEther("1") // 1 Ether, or 1e18 (10^18) Wei
const BASE_FEE = "250000000000000000"// premium section in docs// 0.25 is this the premium in LINK
const GAS_PRICE_LINK =  1e9 // link per gas, is this the gas lane? // 0.000000001 LINK per gas

module.exports = async({getNamedAccounts,deployments})=>{
    const {deployer} = await getNamedAccounts();
    const {deploy,log} = deployments;
    const chainId = network.config.chainId

    let subscriptionId
    let vrfCoordinatorAddress
    let VRFCoordinatorV2Mock

    if(developmentChains.includes(network.name)){
        log("Local network detected. Deploying Mocks....")
        const signer = await ethers.getSigner(deployer)
        const VRFCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock",signer)
        VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(BASE_FEE, GAS_PRICE_LINK)
        vrfCoordinatorAddress = await VRFCoordinatorV2Mock.getAddress()
        console.log(vrfCoordinatorAddress)
        const transaction = await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transaction.wait(1)
        // console.log(transactionReceipt.logs[0].args[0])
        // subscriptionId = BigInt(transactionReceipt.events[0].topics[1])
        subscriptionId = BigInt(transactionReceipt.logs[0].args[0])
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
        log("Mocks Deployed!")
        log("----------------------------------------------------------")
        log("You are deploying to a local network, you'll need a local network running to interact")
        log(
            "Please run `npx hardhat console --network localhost` to interact with the deployed smart contracts!"
        )
        log("----------------------------------------------------------")
    }
    else{
        subscriptionId=networkConfig[chainId].subscriptionId,
        vrfCoordinatorAddress=networkConfig[chainId].vrfCoordinatorAddress
    }

    const arguments = [minEthBalance,maxEthBalance,vrfCoordinatorAddress,subscriptionId,networkConfig[chainId].gasLane,networkConfig[chainId].callbackGasLimit,straightUpBetsValue,outsideBetsValue]
    log("Deploying Contract Roulette.....")
    const roulette = await deploy("Roulette",{
        from:deployer,
        args:arguments,
        log:true
    })
    log("contract deployed")

    if(developmentChains.includes(network.name)) {
        log("adding consumer to mock")
        await VRFCoordinatorV2Mock.addConsumer(subscriptionId, roulette.address)
        log('Consumer is added')
    }

    // Verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(roulette.address, arguments)
    }
}

module.exports.tags = ["all","roulette"]