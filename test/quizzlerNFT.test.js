const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { compareNumbers } = require("../utils");

describe("Quizzler testing", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.admin = this.signers[0];
    this.other = this.signers[1];

    const Quizzler = await ethers.getContractFactory("QuizzlerNFT");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;
  });

  it("should initialize with correct owner", async function () {
    expect(await this.quizzler.owner()).to.equal(this.admin.address);
  });

  it("should allow the owner to set a manager", async function () {
    await this.quizzler.setManager(this.other.address, true);
    expect(await this.quizzler.managers(this.other.address)).to.be.true;
  });

  it("should not allow non-owners to set a manager", async function () {
    await expect(
      this.quizzler.connect(this.other).setManager(this.other.address, true),
    ).to.be.revertedWithCustomError(
      this.quizzler,
      "OwnableUnauthorizedAccount",
    );
  });

  it("should allow the owner to set the gas station address", async function () {
    await this.quizzler.setGasStation(this.other.address, this.admin.address);
    expect(await this.quizzler.gasStation()).to.equal(this.other.address);
  });

  it("should not allow non-owners to set the gas station address", async function () {
    await expect(
      this.quizzler
        .connect(this.other)
        .setGasStation(this.other.address, this.admin.address),
    ).to.be.revertedWithCustomError(
      this.quizzler,
      "OwnableUnauthorizedAccount",
    );
  });
});

describe("Quizzler creation", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.admin = this.signers[0];
    this.other = this.signers[1];
    this.user = this.signers[2];

    const Quizzler = await ethers.getContractFactory("QuizzlerNFT");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.params = {
      token: this.proofToken,
      timeToExpire: this.expireTS,
      owner: this.user.address,
      surveyId: "1",
      name: "Survey Name",
      symbol: "SVY",
      baseTokenURI: "https://api.example.com/surveys/1.json",
      participantsLimit: 100,
      surveyHash: ethers.encodeBytes32String("hash"),
      amountToGasStation: ethers.parseEther("1"),
    };

    this.message = await this.quizzler.createProof(this.params);
  });

  it("should prevent creating a survey with existing ID", async function () {
    let signature = await this.admin.signMessage(ethers.getBytes(this.message));
    await this.quizzler
      .connect(this.user)
      .createSurvey(signature, this.params, {
        value: ethers.parseEther("1"),
      });

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);
    let params = {
      token: this.proofToken,
      timeToExpire: this.expireTS,
      owner: this.user.address,
      surveyId: "1",
      name: "Survey Name",
      symbol: "SVY",
      baseTokenURI: "https://api.example.com/surveys/1.json",
      participantsLimit: 100,
      surveyHash: ethers.encodeBytes32String("hash"),
      amountToGasStation: ethers.parseEther("1"),
    };
    this.message = await this.quizzler.createProof(params);

    signature = await this.admin.signMessage(ethers.getBytes(this.message));
    await expect(
      this.quizzler.connect(this.user).createSurvey(signature, params, {
        value: ethers.parseEther("1"),
      }),
    ).to.be.revertedWith("Quizzler: survey already exists");
  });

  it("should allow survey creator to fund the survey", async function () {
    const signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler.connect(this.user).createSurvey(signature, this.params, {
        value: ethers.parseEther("1"),
      }),
    ).to.emit(this.quizzler, "SurveyFunded");
  });

  it("should not allow non-creators or unauthorized funding", async function () {
    const signature = await this.other.signMessage(
      ethers.getBytes(this.message),
    );

    const fakeParams = {
      ...this.params,
      owner: this.admin.address,
    };

    await expect(
      this.quizzler.connect(this.other).createSurvey(signature, fakeParams, {
        value: ethers.parseEther("1"),
      }),
    ).to.be.revertedWith("Quizzler: only survey creator can fund the survey");

    await expect(
      this.quizzler.createSurvey(signature, fakeParams, {
        value: ethers.parseEther("1"),
      }),
    ).to.be.revertedWith("Quizzler: invalid signer");
  });
});

describe("Quizzler pay rewards", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.admin = this.signers[0];
    this.other = this.signers[1];

    const Quizzler = await ethers.getContractFactory("QuizzlerNFT");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.params = {
      token: this.proofToken,
      timeToExpire: this.expireTS,
      owner: this.admin.address,
      surveyId: "1",
      name: "Survey Name",
      symbol: "SVY",
      baseTokenURI: "https://api.example.com/surveys/1.json",
      participantsLimit: 100,
      surveyHash: ethers.encodeBytes32String("hash"),
      amountToGasStation: ethers.parseEther("1"),
    };

    this.message = await this.quizzler.createProof(this.params);

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.createSurvey(this.signature, this.params, {
      value: ethers.parseEther("1"),
    });
  });

  it("should allow managers to pay rewards", async function () {
    const surveys = ["1", "1"];
    const participants = [this.signers[2].address, this.signers[3].address];

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.message = await this.quizzler.rewardProof(
      this.proofToken,
      this.expireTS,
      surveys,
      participants,
    );

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler.payRewards(
        this.signature,
        this.proofToken,
        this.expireTS,
        surveys,
        participants,
      ),
    ).to.emit(this.quizzler, "RewardPaid");

    const surveyData = await this.quizzler.getSurvey("1");
    const nft = await ethers.getContractAt("QstnNFT", surveyData.nftContract);
    const balance = await nft.balanceOf(this.signers[2].address);
    expect(balance).to.equal(1);
  });

  it("should prevent non-managers from paying rewards", async function () {
    const surveys = ["1", "1"];
    const participants = [this.signers[2].address, this.signers[3].address];

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.message = await this.quizzler.rewardProof(
      this.proofToken,
      this.expireTS,
      surveys,
      participants,
    );

    this.signature = await this.signers[2].signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler
        .connect(this.other)
        .payRewards(
          this.signature,
          this.proofToken,
          this.expireTS,
          surveys,
          participants,
        ),
    ).to.be.revertedWith("Quizzler: invalid signer");
  });
});

describe("Quizzler cancel survey", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.admin = this.signers[0];
    this.other = this.signers[1];

    const Quizzler = await ethers.getContractFactory("QuizzlerNFT");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.params = {
      token: this.proofToken,
      timeToExpire: this.expireTS,
      owner: this.admin.address,
      surveyId: "1",
      name: "Survey Name",
      symbol: "SVY",
      baseTokenURI: "https://api.example.com/surveys/1.json",
      participantsLimit: 100,
      surveyHash: ethers.encodeBytes32String("hash"),
      amountToGasStation: ethers.parseEther("1"),
    };

    this.message = await this.quizzler.createProof(this.params);

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.createSurvey(this.signature, this.params, {
      value: ethers.parseEther("1"),
    });

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);
    this.message = await this.quizzler.cancelProof(
      this.proofToken,
      this.expireTS,
      "1",
    );
    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );
  });

  it("should allow the survey creator to cancel the survey", async function () {
    await expect(
      this.quizzler.cancelSurvey(
        this.signature,
        this.proofToken,
        this.expireTS,
        "1",
      ),
    )
      .to.emit(this.quizzler, "SurveyCanceled")
      .withArgs("1");
  });

  it("should prevent non-creator/non-managers from canceling the survey", async function () {
    await expect(
      this.quizzler
        .connect(this.other)
        .cancelSurvey(this.signature, this.proofToken, this.expireTS, "1"),
    ).to.be.revertedWith(
      "Quizzler: only survey creator or manager can cancel the survey",
    );
  });

  it("should prevent double cancellation", async function () {
    await this.quizzler.cancelSurvey(
      this.signature,
      this.proofToken,
      this.expireTS,
      "1",
    );

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);
    this.message = await this.quizzler.cancelProof(
      this.proofToken,
      this.expireTS,
      "1",
    );
    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler.cancelSurvey(
        this.signature,
        this.proofToken,
        this.expireTS,
        "1",
      ),
    ).to.be.revertedWith("Quizzler: survey is already canceled");
  });

  it("should prevent cancelation after payments", async function () {
    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.params = {
      token: this.proofToken,
      timeToExpire: this.expireTS,
      owner: this.admin.address,
      surveyId: "2",
      name: "Survey Name",
      symbol: "SVY",
      baseTokenURI: "https://api.example.com/surveys/1.json",
      participantsLimit: 2,
      surveyHash: ethers.encodeBytes32String("hash"),
      amountToGasStation: ethers.parseEther("1"),
    };

    this.message = await this.quizzler.createProof(this.params);

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.createSurvey(this.signature, this.params, {
      value: ethers.parseEther("1"),
    });

    // ________

    const surveys = ["2", "2"];
    const participants = [this.signers[2].address, this.signers[3].address];

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.message = await this.quizzler.rewardProof(
      this.proofToken,
      this.expireTS,
      surveys,
      participants,
    );

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.payRewards(
      this.signature,
      this.proofToken,
      this.expireTS,
      surveys,
      participants,
    );

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);
    this.message = await this.quizzler.cancelProof(
      this.proofToken,
      this.expireTS,
      "2",
    );
    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler.cancelSurvey(
        this.signature,
        this.proofToken,
        this.expireTS,
        "2",
      ),
    ).to.be.revertedWith("Quizzler: all participants have been rewarded");
  });
});
