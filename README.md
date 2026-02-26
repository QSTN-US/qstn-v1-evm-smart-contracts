# QSTN + EVM Networks - Work in Progress

<p align="center">
  <a href="https://qstn.us/"><img src="https://qstn.us/icon-256x256.png" alt="QSTN Marketplace"></a>
</p>

**🚀 QSTN is a platform that connects businesses and individuals through market research surveys. We partner with companies seeking consumer feedback and provide users the opportunity to earn rewards while sharing their opinions.**

Website - [https://qstn.us](https://qstn.us)
Testnet - [https://testnet.qstnus.com](https://testnet.qstnus.com)

---

## QSTN Survey Smart Contracts Documentation

Welcome to the QSTN Survey Smart Contracts repository. This guide explains how to deploy, upgrade, verify, and test our upgradeable smart contracts on EVM networks.

---

## Table of Contents

* Introduction
* Prerequisites
* Installation
* Contract Overview
* Deployment (Ignition + UUPS)
* Verification
* Upgrading Contracts
* Testing
* Contributing
* Support
* License

---

## Introduction

QSTN provides a decentralized solution for businesses to fund surveys using smart contracts on EVM blockchains.

The contracts use:

* **UUPS upgradeability pattern**
* **Hardhat Ignition** for deterministic deployments
* **OpenZeppelin upgradeable contracts**

This ensures:

* Safe upgrade paths
* Clean deployment workflows
* Production-grade contract architecture

---

## Prerequisites

Ensure you have:

* Node.js (>=18)
* Yarn
* Hardhat
* An EVM RPC endpoint
* A funded deployer wallet

Hardhat setup instructions:
[https://hardhat.org/hardhat-runner/docs/getting-started](https://hardhat.org/hardhat-runner/docs/getting-started)

---

## Installation

```bash
git clone https://github.com/QSTN-US/EVM-QSTN-v2
cd EVM-QSTN-v2
yarn
npx hardhat compile
npx hardhat test
```

---

# Contract Overview

This repository contains upgradeable smart contracts for creating and funding surveys.

### Quizzler.sol

Upgradeable contract for creating and managing surveys with native token rewards.

### QuizzlerNFT.sol

Upgradeable contract for creating and managing surveys with NFT-based rewards.

---

## Core Functions

### createSurvey

```solidity
function createSurvey(
    bytes memory _signature,
    bytes32 _token,
    uint256 _timeToExpire,
    address _owner,
    string memory _surveyId,
    uint256 _participantsLimit,
    uint256 _rewardAmount,
    bytes32 _surveyHash,
    uint256 _amountToGasStation
) external payable nonReentrant {}
```

Creates and funds a survey.
Requires backend signature verification for security.

---

### payRewards

```solidity
function payRewards(
    bytes memory _signature,
    bytes32 _token,
    uint256 _timeToExpire,
    string[] memory _surveyIds,
    address[] memory _participantsEncoded
) external nonReentrant {}
```

Distributes rewards to survey participants.
Callable only by authorized manager accounts.

---

# Deployment (Ignition + UUPS)

Contracts use the **UUPS proxy pattern** and are deployed via Hardhat Ignition modules.

Set required environment variables:

```bash
npx hardhat vars set AMM_FORK_URL
npx hardhat vars set ETHERSCAN_API_KEY
npx hardhat vars set DEPLOYER_PRIVATE_KEY
```

---

## Deploy Quizzler

```bash
npx hardhat ignition deploy ignition/modules/Quizzler.ts \
  --network arbitrum-sepolia \
  --deployment-id quizzler-deployment
```

---

## Deploy QuizzlerNFT

```bash
npx hardhat ignition deploy ignition/modules/QuizzlerNFT.ts \
  --network arbitrum-sepolia \
  --deployment-id quizzler-nft-deployment
```

Ignition will:

* Deploy implementation
* Deploy ERC1967 proxy
* Call initialize()
* Execute setup calls (e.g. setGasStation, setManager)

Deployment artifacts are stored under:

```text
ignition/deployments/
```

---

## Verification

After deployment:

```bash
npx hardhat ignition verify quizzler-deployment
npx hardhat ignition verify quizzler-nft-deployment
```

This verifies:

* Implementation contract
* Proxy contract
* Links them correctly on block explorer

Requires `ETHERSCAN_API_KEY` to be set.

---

## Upgrading Contracts (UUPS)

To upgrade:

1. Deploy new implementation via Ignition.
2. Call `upgradeTo(newImplementation)` through the proxy.

Example (inside upgrade module):

```ts
m.call(quizzler, "upgradeTo", [newImplementation]);
```

Upgrade authorization is enforced by:

```solidity
function _authorizeUpgrade(address newImplementation)
    internal
    override
    onlyOwner
{}
```

Only the contract owner can upgrade.

---

## Testing

Run unit tests:

```bash
npx hardhat test
```

Tests cover:

* Survey creation
* Reward distribution
* Signature validation
* Upgrade safety
* Access control

For fork testing:

```bash
npx hardhat test --network hardhat
```

---

## Development Notes

* Contracts use UUPS upgradeability.
* Never reorder state variables.
* Only append new storage variables.
* Maintain storage gaps where necessary.

---

## Contributing

We welcome contributions. Please open a pull request or submit an issue.

---

## Support

For issues:

* Open a GitHub issue
* Email: [support@qstn.us](mailto:support@qstn.us)

---

## License

MIT License. See LICENSE file.

---
