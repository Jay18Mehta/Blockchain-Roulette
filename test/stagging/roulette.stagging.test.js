const { network, ethers, getNamedAccounts } = require("hardhat")
const { assert, expect } = require("chai")
const {developmentChains}=require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
:describe("Roulette Stagging Test",()=>{
    let roulette,deployer,signer
    beforeEach(async()=>{
        deployer = (await getNamedAccounts()).deployer
        signer = await ethers.getSigner(deployer)
        // await deployments.fixture("roulette")
        roulette = await ethers.getContractAt("Roulette","0x8c8D0A5503E039B90811A8f162249072A195346b",signer)
    })
    it("works with live Chainlink VRF, we get a random number", async function () {
        console.log("Setting up test...")
        await roulette.fundContract({value:ethers.parseEther("0.1")})
        await roulette.addBalance({value:ethers.parseEther("0.02")})

        console.log("Setting up Listener...")
        await new Promise(async (resolve, reject) => {
            roulette.once("numberPicked", async () => { // event listener for numberPicked
                console.log("numberPicked event fired!")
                try {
                    const userMapping = await roulette.getUserMapping(deployer)
                    assert.equal(userMapping[2].toString(),["21","22","23","24"])
                    assert.equal(userMapping[3].toString(),["ONE_TO_TWELVE","EVEN"])
                    resolve() // if try passes, resolves the promise 
                } catch (e) { 
                    reject(e) // if try fails, rejects the promise
                }
            })

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            try {
                console.log("requesting random number")
                const tx = await roulette.requestRandomWords([21,22,23,24],["ONE_TO_TWELVE","EVEN"])
                const txReceipt = await tx.wait(1)
                console.log("time to wait....")
                
            } catch (e) {
                reject(e)
            }
        })
    })
})