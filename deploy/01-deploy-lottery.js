// @ts-nocheck
const { ethers, network } = require("hardhat")
const { devChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_AMOUNT = ethers.utils.parseEther("5")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  let vrfCoordinatorV2Address, subscriptionId

  if (devChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
    const txResponse = await vrfCoordinatorV2Mock.createSubscription()
    const txReceipt = await txResponse.wait(1)
    subscriptionId = txReceipt.events[0].args.subId
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_AMOUNT)
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
  }

  const entranceFee = networkConfig[chainId]["entranceFee"]
  const keyHash = networkConfig[chainId]["keyHash"]
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
  const interval = networkConfig[chainId]["interval"]
  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    keyHash,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  })

  if (!devChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying on Etherscan...")
    await verify(lottery.address, args)
  }

  log("----------------------------------------------------------------")
}

module.exports.tags = ["all", "live"]
