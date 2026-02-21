const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { compareNumbers } = require("../utils");

describe("Quizzler testing", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.admin = this.signers[0];
    this.other = this.signers[1];

    const Quizzler = await ethers.getContractFactory("Quizzler");
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

    const Quizzler = await ethers.getContractFactory("Quizzler");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.message = await this.quizzler.createProof(
      this.proofToken,
      this.expireTS,
      this.user.address,
      "1",
      100,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
    );
  });

  it("should prevent creating a survey with existing ID", async function () {
    let signature = await this.admin.signMessage(ethers.getBytes(this.message));

    await this.quizzler
      .connect(this.user)
      .createSurvey(
        signature,
        this.proofToken,
        this.expireTS,
        this.user.address,
        "1",
        100,
        ethers.parseEther("1"),
        ethers.encodeBytes32String("hash"),
        ethers.parseEther("1"),
        { value: ethers.parseEther("101") },
      );

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);
    this.message = await this.quizzler.createProof(
      this.proofToken,
      this.expireTS,
      this.user.address,
      "1",
      100,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
    );

    signature = await this.admin.signMessage(ethers.getBytes(this.message));

    await expect(
      this.quizzler
        .connect(this.user)
        .createSurvey(
          signature,
          this.proofToken,
          this.expireTS,
          this.user.address,
          "1",
          100,
          ethers.parseEther("1"),
          ethers.encodeBytes32String("hash"),
          ethers.parseEther("1"),
          { value: ethers.parseEther("101") },
        ),
    ).to.be.revertedWith("Quizzler: survey already exists");
  });

  it("should allow survey creator to fund the survey", async function () {
    const signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler
        .connect(this.user)
        .createSurvey(
          signature,
          this.proofToken,
          this.expireTS,
          this.user.address,
          "1",
          100,
          ethers.parseEther("1"),
          ethers.encodeBytes32String("hash"),
          ethers.parseEther("1"),
          { value: ethers.parseEther("101") },
        ),
    ).to.emit(this.quizzler, "SurveyFunded");
  });

  it("should not allow non-creators or unauthorized funding", async function () {
    const signature = await this.other.signMessage(
      ethers.getBytes(this.message),
    );

    await expect(
      this.quizzler
        .connect(this.other)
        .createSurvey(
          signature,
          this.proofToken,
          this.expireTS,
          this.admin.address,
          "1",
          100,
          ethers.parseEther("1"),
          ethers.encodeBytes32String("hash"),
          ethers.parseEther("1"),
          { value: ethers.parseEther("101") },
        ),
    ).to.be.revertedWith("Quizzler: only survey creator can fund the survey");

    await expect(
      this.quizzler.createSurvey(
        signature,
        this.proofToken,
        this.expireTS,
        this.admin.address,
        "1",
        100,
        ethers.parseEther("1"),
        ethers.encodeBytes32String("hash"),
        ethers.parseEther("1"),
        { value: ethers.parseEther("101") },
      ),
    ).to.be.revertedWith("Quizzler: invalid signer");
  });
});

describe("Quizzler pay rewards", function () {
  beforeEach(async function () {
    this.signers = await ethers.getSigners();
    this.admin = this.signers[0];
    this.other = this.signers[1];

    const Quizzler = await ethers.getContractFactory("Quizzler");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.message = await this.quizzler.createProof(
      this.proofToken,
      this.expireTS,
      this.admin.address,
      "1",
      100,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
    );

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.createSurvey(
      this.signature,
      this.proofToken,
      this.expireTS,
      this.admin.address,
      "1",
      100,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
      { value: ethers.parseEther("101") },
    );
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

    const Quizzler = await ethers.getContractFactory("Quizzler");
    const quizzler = await upgrades.deployProxy(Quizzler);
    await quizzler.waitForDeployment();

    await quizzler.setManager(this.admin.address, true);
    await quizzler.setGasStation(this.admin.address, this.admin.address);

    this.quizzler = quizzler;

    this.expireTS = Date.now() + 10000;
    this.proofToken = ethers.randomBytes(32);

    this.message = await this.quizzler.createProof(
      this.proofToken,
      this.expireTS,
      this.admin.address,
      "1",
      100,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
    );

    const signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.createSurvey(
      signature,
      this.proofToken,
      this.expireTS,
      this.admin.address,
      "1",
      100,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
      { value: ethers.parseEther("101") },
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

  it("should refund the correct amount to the survey creator", async function () {
    const initialBalance = await ethers.provider.getBalance(this.admin.address);
    await this.quizzler.cancelSurvey(
      this.signature,
      this.proofToken,
      this.expireTS,
      "1",
    );
    const finalBalance = await ethers.provider.getBalance(this.admin.address);
    expect(finalBalance - initialBalance).to.be.closeTo(
      ethers.parseEther("100"),
      ethers.parseEther("0.01"),
    );
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

    this.message = await this.quizzler.createProof(
      this.proofToken,
      this.expireTS,
      this.admin.address,
      "2",
      2,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
    );

    this.signature = await this.admin.signMessage(
      ethers.getBytes(this.message),
    );

    await this.quizzler.createSurvey(
      this.signature,
      this.proofToken,
      this.expireTS,
      this.admin.address,
      "2",
      2,
      ethers.parseEther("1"),
      ethers.encodeBytes32String("hash"),
      ethers.parseEther("1"),
      { value: ethers.parseEther("3") },
    );

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
