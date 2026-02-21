const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { ethers, upgrades } = require("hardhat");
const { waitBlocks } = require("../utils/blockWaiter");

const MANAGER_ADDRESS = "0xF4b4694C6105F720c530C17De87466Bcf52e8D56";

async function main() {
  const Quizzler = await ethers.getContractFactory("QuizzlerNFT");
  const quizzler = await upgrades.deployProxy(Quizzler, [], {
    timeout: 0,
  });
  await quizzler.deployed();
  await waitBlocks(5);

  const quizzlerImpl = await getImplementationAddress(
    ethers.provider,
    quizzler.address
  );
  console.log(`Quizzler deployed to: ${quizzler.address} => ${quizzlerImpl}`);

  try {
    await run("verify:verify", {
      address: quizzlerImpl,
      contract: "contracts/QuizzlerNFT.sol:QuizzlerNFT",
    });
  } catch (error) {
    console.log("Verify failed: ", error);
  }

  await quizzler.setGasStation(MANAGER_ADDRESS, MANAGER_ADDRESS);
  await quizzler.setManager(MANAGER_ADDRESS, true);

  console.log("DONE!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
