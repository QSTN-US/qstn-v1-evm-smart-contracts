import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MANAGER_ADDRESS = "0xF4b4694C6105F720c530C17De87466Bcf52e8D56";

const QuizzlerNftModule = buildModule("QuizzlerNftModule", (m) => {
  const implementation = m.contract("QuizzlerNFT", [], {
    id: "QuizzlerNftImpl",
  });

  const initData = m.encodeFunctionCall(implementation, "initialize", []);

  const proxy = m.contract("ERC1967Proxy", [implementation, initData]);

  const quizzler = m.contractAt("QuizzlerNFT", proxy);

  m.call(quizzler, "setGasStation", [MANAGER_ADDRESS, MANAGER_ADDRESS]);

  m.call(quizzler, "setManager", [MANAGER_ADDRESS, true]);

  return {
    implementation,
    proxy,
    quizzler,
  };
});

export default QuizzlerNftModule;
