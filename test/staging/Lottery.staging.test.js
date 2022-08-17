// @ts-nocheck
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { assert, expect } = require("chai")
const { devChains, networkConfig } = require("../../helper-hardhat-config")

if (devChains.includes(network.name)) {
  describe.skip
} else {
  describe("Lottery Unit Tests", function () {
    let lottery, entranceFee, deployer

    beforeEach(async function () {
      deployer = (await getNamedAccounts()).deployer
      lottery = await ethers.getContract("Lottery", deployer)
      entranceFee = await lottery.getEntranceFee()
    })

    describe("fulfillRandomWords", function () {
      it("Should work with live Chainlink Keepers and Chainlink VRF, and pick a winner", async function () {
        const startingTimeStamp = await lottery.getLatestTimeStamp()
        const accounts = await ethers.getSigners()

        await new Promise(async (resolve, reject) => {
          lottery.once("LotteryRecentWinners", async () => {
            try {
              const recentWinner = await lottery.getRecentWinner()
              const lotteryState = await lottery.getLotteryState()
              const endingTimeStamp = await lottery.getLatestTimeStamp()
              const winnerEndingBalance = await accounts[0].getBalance()

              await expect(lottery.getPlayer(0)).to.be.reverted
              assert(recentWinner.toString() === accounts[0].address)
              assert(lotteryState.toString() === "0")
              assert(endingTimeStamp > startingTimeStamp)
              assert(
                winnerEndingBalance.toString() === winnerStartingBalance.add(entranceFee).toString()
              )
              resolve()
            } catch (err) {
              reject(err)
            }
          })
          await lottery.enterLottery({ value: entranceFee })
          const winnerStartingBalance = await accounts[0].getBalance()
        })
      })
    })
  })
}
