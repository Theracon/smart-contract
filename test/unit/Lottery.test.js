// @ts-nocheck
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { assert, expect } = require("chai")
const { devChains, networkConfig } = require("../../helper-hardhat-config")

if (!devChains.includes(network.name)) {
  describe.skip
} else {
  describe("Lottery Unit Tests", function () {
    let vrfCoordinatorV2Mock, lottery, entranceFee, deployer, interval
    const chainId = network.config.chainId

    beforeEach(async function () {
      deployer = (await getNamedAccounts()).deployer
      await deployments.fixture(["all"])
      vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
      lottery = await ethers.getContract("Lottery", deployer)
      entranceFee = await lottery.getEntranceFee()
      interval = await lottery.getInterval()
    })

    describe("constructor", function () {
      it("Should initialize the lottery correctly", async function () {
        const lotteryState = await lottery.getLotteryState()
        assert.equal(lotteryState.toString(), "0")
        assert.equal(interval.toString(), networkConfig[chainId]["interval"])
      })
    })

    describe("enterLottery", function () {
      it("Should revert when you don't pay enough", async function () {
        await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughEthEntered")
      })
      it("Should not allows you to enter when lottery is calculating", async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        await lottery.performUpkeep([])
        await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
          "Lottery__NotOpen"
        )
      })
      it("Should record players when they enter", async function () {
        await lottery.enterLottery({ value: entranceFee })
        const lotteryPlayer = await lottery.getPlayer(0)
        assert.equal(lotteryPlayer, deployer)
      })
      it("Should emit an event when a player enters", async function () {
        await expect(lottery.enterLottery({ value: entranceFee })).to.emit(lottery, "LotteryEnter")
      })
    })

    describe("checkUpkeep", function () {
      it("Should return false if no ETH has been sent", async function () {
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
        assert(!upkeepNeeded)
      })
      it("Should return false if lottery is not open", async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        await lottery.performUpkeep([])
        const lotteryState = await lottery.getLotteryState()
        const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
        assert.equal(lotteryState.toString(), "1")
        assert(!upkeepNeeded)
      })
      it("Should return false if interval is insufficient", async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
        await network.provider.send("evm_mine", [])
        const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
        assert(!upkeepNeeded)
      })
      it("Should return true when all upkeep conditions are met", async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
        assert(upkeepNeeded)
      })
    })

    describe("performUpkeep", function () {
      it("Should only run when checkUpkeep is true", async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const tx = await lottery.performUpkeep([])
        assert(tx)
      })
      it("Should revert when checkUpkeep is false", async function () {
        await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded")
      })
      it("Should update the lottery state, emit an event, and call the vrf coordinator", async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
        const txResponse = await lottery.performUpkeep([])
        const txReceipt = await txResponse.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        const lotteryState = await lottery.getLotteryState()
        assert(requestId.toNumber() > 0)
        assert(lotteryState.toString() === "1")
      })
    })

    describe("fulfillRandomWords", function () {
      beforeEach(async function () {
        await lottery.enterLottery({ value: entranceFee })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.send("evm_mine", [])
      })

      it("Should be called only after performUpkeep is called", async function () {
        await expect(
          vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
        ).to.be.revertedWith("nonexistent request")
        await expect(
          vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
        ).to.be.revertedWith("nonexistent request")
      })
      it("Should pick a winner, reset the lottery, and send money", async function () {
        const additionalEntrants = 3
        const startingIndex = 1
        const accounts = await ethers.getSigners()
        for (let i = startingIndex; i < startingIndex + additionalEntrants; i++) {
          const connectedAccount = lottery.connect(accounts[i])
          await connectedAccount.enterLottery({ value: entranceFee })
        }
        const startingTimeStamp = await lottery.getLatestTimeStamp()

        await new Promise(async (resolve, reject) => {
          lottery.once("LotteryRecentWinners", async () => {
            try {
              const recentWinner = await lottery.getRecentWinner()
              const lotteryState = await lottery.getLotteryState()
              const endingTimeStamp = await lottery.getLatestTimeStamp()
              const numPlayers = await lottery.getNumberOfPlayers()
              const winnerEndingBalance = await accounts[1].getBalance()

              assert(lotteryState.toString() === "0")
              assert(endingTimeStamp > startingTimeStamp)
              assert(numPlayers.toString() === "0")
              assert(
                winnerEndingBalance.toString() ===
                  winnerStartingBalance
                    .add(entranceFee.mul(additionalEntrants).add(entranceFee))
                    .toString()
              )
              resolve()
            } catch (err) {
              reject(err)
            }
          })
          const tx = await lottery.performUpkeep([])
          const txReceipt = await tx.wait(1)
          const winnerStartingBalance = await accounts[1].getBalance()
          await vrfCoordinatorV2Mock.fulfillRandomWords(
            txReceipt.events[1].args.requestId,
            lottery.address
          )
        })
      })
    })
  })
}
