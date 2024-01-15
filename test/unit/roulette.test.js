const { network, ethers, getNamedAccounts } = require("hardhat")
const { assert, expect } = require("chai")
const {developmentChains}=require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
:describe("Roulette Unit Test",()=>{

    let roulette,deployer,signer,vrfCoordinatorV2Mock
    beforeEach(async()=>{
        deployer = (await getNamedAccounts()).deployer
        signer = await ethers.getSigner(deployer)
        // await deployments.fixture("roulette")
        roulette = await ethers.getContractAt("Roulette","0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",signer)
        vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock","0x5FbDB2315678afecb367f032d93F642f64180aa3",signer)
    })

    it("Should initialize correctly",async()=>{
        // await roulette.addBalance({value:ethers.parseEther("0.05")})
        const response = await roulette.getMinEthBalance()
        const response2 = await roulette.getMaxEthBalance()
        const owner = await roulette.getContractOwner()
        const contractFund = await roulette.getContractFund()
        assert.equal(response,ethers.parseEther("0.01"))
        assert.equal(response2,ethers.parseEther("0.1"))
        assert.equal(owner,deployer)
        assert.equal(contractFund,0)
    })

    describe("testing fundContract Function",()=>{
        it("should only allow owner to add fund",async()=>{
            const accounts = await ethers.getSigners()
            await roulette.fundContract({value:ethers.parseEther("0.1")})
            const rouletteConnectedContract = await roulette.connect(accounts[1])
            await expect(rouletteConnectedContract.fundContract({value:ethers.parseEther("0.1")})).to.be.rejectedWith("roulette__NotOwner")
        })
        it("should modify contract funds correctly",async()=>{
            const currentFunds = await roulette.getContractFund()
            await roulette.fundContract({value:ethers.parseEther("0.1")})
            const finalFunds = await roulette.getContractFund()
            assert.equal(finalFunds,currentFunds+ethers.parseEther("0.1"))
        })
    })

    describe("testing addBalance function",()=>{
        it("value parameter should be bounded",async()=>{
            await expect(roulette.addBalance({value:ethers.parseEther("0.009")})).to.be.reverted
            await expect(roulette.addBalance({value:ethers.parseEther("0.11")})).to.be.reverted
        })
        it("user can addBalance multiple times with staying in limit",async()=>{
            const balance = await roulette.getUserMapping(deployer)
            assert.equal(balance[0].toString(),ethers.parseEther("0"))

            await roulette.addBalance({value:ethers.parseEther("0.03")})
            const balance2 = await roulette.getUserMapping(deployer)
            assert.equal(balance2[0].toString(),ethers.parseEther("0.03"))
            await roulette.addBalance({value:ethers.parseEther("0.06")})
            const balance3 = await roulette.getUserMapping(deployer)
            assert.equal(balance3[0].toString(),ethers.parseEther("0.09"))
        })
        it("should work with multiple users",async()=>{
            const accounts = await ethers.getSigners()
            for(let i =1;i<6;i++){
                const rouletteConnectedContract = await roulette.connect(accounts[i])
                await rouletteConnectedContract.addBalance({value:ethers.parseEther((0.01*i).toString())})
                const balance = await rouletteConnectedContract.getUserMapping(accounts[i])
                assert.equal(balance[0].toString(),ethers.parseEther((0.01*i).toString()))
            }
            for(let i =1;i<6;i++){
                const rouletteConnectedContract = await roulette.connect(accounts[6-i])
                await rouletteConnectedContract.addBalance({value:ethers.parseEther((0.01*i).toString())})
                const balance = await rouletteConnectedContract.getUserMapping(accounts[6-i])
                assert.equal(balance[0].toString(),ethers.parseEther("0.06"))
            }
        })
    })

    describe("testing withdrawBalance function",()=>{
        beforeEach(async()=>{
            const accounts = await ethers.getSigners()
            for(let i =1;i<6;i++){
                const rouletteConnectedContract = await roulette.connect(accounts[i])
                await rouletteConnectedContract.addBalance({value:ethers.parseEther("0.01")})
            }
        })
        it("users should have 0 balance after withdrawing",async()=>{
            const accounts = await ethers.getSigners()
            for(let i =1;i<6;i++){
                const rouletteConnectedContract = await roulette.connect(accounts[i])
                await rouletteConnectedContract.withdrawBalance()
                const balance = await rouletteConnectedContract.getUserMapping(accounts[i])
                // console.log(balance)
                assert.equal(balance[0].toString(),0)
            }
        })
        it("checking users balance after withdrawing",async()=>{
            const users = await ethers.getSigners()
            await roulette.fundContract({value:ethers.parseEther("0.1")})
            const rouletteConnectedContract = await roulette.connect(users[7])

            await rouletteConnectedContract.addBalance({value:ethers.parseEther("0.1")})
            const initialBalance = await ethers.provider.getBalance(users[7].address)
            // console.log(await rouletteConnectedContract.getUserMapping(users[7].address))
            const transactionResponse = await rouletteConnectedContract.withdrawBalance()
            const transactionReceipt = await transactionResponse.wait()
            const { gasUsed, gasPrice} = transactionReceipt
            const finalBalance = await ethers.provider.getBalance(users[7].address)
            // console.log(await rouletteConnectedContract.getUserMapping(users[7].address))
            // console.log(finalBalance,gasUsed,gasPrice,initialBalance)
            assert.equal(finalBalance+(gasUsed*gasPrice),initialBalance+ethers.parseEther("0.1"))

        })

    })

    describe("testing requestRandomWords function",()=>{

        beforeEach(async()=>{
            const accounts = await ethers.getSigners()
            for(let i =1;i<6;i++){
                const rouletteConnectedContract = await roulette.connect(accounts[i])
                await rouletteConnectedContract.withdrawBalance()
            }
        })
        it("should only work if contract have fund and user has enough money",async()=>{
            const accounts = await ethers.getSigners()
            const rouletteConnectedContract = await roulette.connect(accounts[1])
            // console.log(await rouletteConnectedContract.getUserMapping(accounts[1].address))
            await expect(rouletteConnectedContract.requestRandomWords([1,2,3,4],[])).to.be.rejectedWith("roulette__NotEnoughMoneyToPlay")
            
            await rouletteConnectedContract.addBalance({value:ethers.parseEther("0.03")})
            await roulette.withdrawContractFund(await roulette.getContractFund())
            await expect(roulette.requestRandomWords([1,2,3,4],[])).to.be.rejectedWith("roulette__notEnoughMoneyInContract")
        })
        it("should update outsidebets and straightUpBets for every user",async()=>{
            const accounts = await ethers.getSigners()
            await roulette.fundContract({value:ethers.parseEther("0.03")})

            const rouletteConnectedContract = await roulette.connect(accounts[1])
            await rouletteConnectedContract.addBalance({value:ethers.parseEther((0.01*1).toString())})
            await rouletteConnectedContract.requestRandomWords([1,2,3,4],["THIRD_COLOUMN","ONE_TO_TWELVE"])
            const user = await rouletteConnectedContract.getUserMapping(accounts[1])
            assert.equal(user[2].toString(),["1","2","3","4"])
            assert.equal(user[3].toString(),["THIRD_COLOUMN","ONE_TO_TWELVE"])

            const rouletteConnectedContract2 = await roulette.connect(accounts[2])
            await rouletteConnectedContract2.addBalance({value:ethers.parseEther((0.01*2).toString())})
            await rouletteConnectedContract2.requestRandomWords([10,11,12,13,14],["ODD","BLACK"])
            const user2 = await rouletteConnectedContract2.getUserMapping(accounts[2])
            assert.equal(user2[2].toString(),["10","11","12","13","14"])
            assert.equal(user2[3].toString(),["ODD","BLACK"])
        })
    })

    describe("testing calculateWinAmount Function",()=>{
        it("should have correct winAmount test1",async()=>{
            await expect(roulette.calculateWinAmount(10,[1,2,3,4],[]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("-0.002"));
        })
        it("should have correct winAmount test2",async()=>{
            await expect(roulette.calculateWinAmount(1,[1,2,3,4],[]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("0.016"));
        })
        it("should have correct winAmount test3",async()=>{
            await expect(roulette.calculateWinAmount(10,[],["ONE_TO_TWELVE","ODD"]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("0.0025"));
        })
        it("should have correct winAmount test4",async()=>{
            await expect(roulette.calculateWinAmount(10,[],["ONE_TO_TWELVE","EVEN"]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("0.0075"));
        })
        it("should have correct winAmount test5",async()=>{
            await expect(roulette.calculateWinAmount(35,[],["TWENTYFIVE_TO_THIRTYSIX","FIRST_COLOUMN"]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("0.0025"));
        })
        it("should have correct winAmount test6",async()=>{
            await expect(roulette.calculateWinAmount(10,[],["RED","EVEN"]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("0"));
        })
        it("should have correct winAmount test7",async()=>{
            await expect(roulette.calculateWinAmount(10,[],["BLACK","EVEN"]))
                .to.emit(roulette, "winAmountEvent")
                .withArgs(ethers.parseEther("0.005"));
        })
    })   
    
    describe("testing fullfillRandomWords function",()=>{
        beforeEach(async()=>{
            await roulette.withdrawBalance()
            await roulette.fundContract({value:ethers.parseEther("0.1")})
            await roulette.addBalance({value:ethers.parseEther("0.02")})
        })
        it("should be called externaly and should update user and contractFund",async()=>{

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
                    const tx = await roulette.requestRandomWords([21,22,23,24],["ONE_TO_TWELVE","EVEN"])
                    const txReceipt = await tx.wait(1)
                    await vrfCoordinatorV2Mock.fulfillRandomWords(  //requires requestId and contractAddress
                        txReceipt.logs[1].args[0],
                        await roulette.getAddress()
                    )
                } catch (e) {
                    reject(e)
                }
            })
        })
    })

    describe("checking withdrawContractFund function",()=>{
        it("should only allow owner to withdraw",async()=>{
            const accounts = await ethers.getSigners()
            await roulette.fundContract({value:ethers.parseEther("0.01")})
            const rouletteConnectedContract = await roulette.connect(accounts[1])
            await expect(rouletteConnectedContract.withdrawContractFund(ethers.parseEther("0.005"))).to.be.rejectedWith("roulette__NotOwner")
            await roulette.withdrawContractFund(ethers.parseEther("0.005"))
        })
    })
})