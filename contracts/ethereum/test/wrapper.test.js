const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CasperBridgeWrapper", function () {
  let wrapper;
  let owner;
  let validator1;
  let validator2;
  let user;

  const REQUIRED_SIGS = 2;
  const MIN_BURN = ethers.parseEther("1");

  // Helper function to generate valid signatures for mint proof
  async function generateMintSignatures(proof, validators) {
    const messageHash = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'address', 'uint256'],
      [proof.sourceChain, proof.sourceTxHash, proof.amount, proof.recipient, proof.nonce]
    );

    const signatures = [];
    for (const validator of validators) {
      const signature = await validator.signMessage(ethers.getBytes(messageHash));
      signatures.push(signature);
    }

    return signatures;
  }

  beforeEach(async function () {
    [owner, validator1, validator2, user] = await ethers.getSigners();

    const CasperBridgeWrapper = await ethers.getContractFactory("CasperBridgeWrapper");
    wrapper = await CasperBridgeWrapper.deploy(REQUIRED_SIGS, MIN_BURN);
    await wrapper.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await wrapper.owner()).to.equal(owner.address);
    });

    it("Should set required signatures", async function () {
      expect(await wrapper.requiredSignatures()).to.equal(REQUIRED_SIGS);
    });

    it("Should set min burn amount", async function () {
      expect(await wrapper.minBurnAmount()).to.equal(MIN_BURN);
    });

    it("Should add owner as first validator", async function () {
      expect(await wrapper.validators(owner.address)).to.equal(true);
    });

    it("Should have correct initial state", async function () {
      const info = await wrapper.getInfo();
      expect(info[0]).to.equal(0); // nonce
      expect(info[1]).to.equal(0); // totalBridged
      expect(info[2]).to.equal(1); // validatorCount
    });
  });

  describe("Validator Management", function () {
    it("Should allow owner to add validator", async function () {
      await wrapper.addValidator(validator1.address);
      expect(await wrapper.validators(validator1.address)).to.equal(true);
    });

    it("Should emit ValidatorAdded event", async function () {
      await expect(wrapper.addValidator(validator1.address))
        .to.emit(wrapper, "ValidatorAdded")
        .withArgs(validator1.address);
    });

    it("Should not allow non-owner to add validator", async function () {
      await expect(
        wrapper.connect(user).addValidator(validator1.address)
      ).to.be.reverted;
    });

    it("Should allow owner to remove validator", async function () {
      await wrapper.addValidator(validator1.address);
      await wrapper.removeValidator(validator1.address);
      expect(await wrapper.validators(validator1.address)).to.equal(false);
    });

    it("Should get all validators", async function () {
      await wrapper.addValidator(validator1.address);
      await wrapper.addValidator(validator2.address);

      const validators = await wrapper.getValidators();
      expect(validators.length).to.equal(3);
      expect(validators).to.include(owner.address);
      expect(validators).to.include(validator1.address);
      expect(validators).to.include(validator2.address);
    });
  });

  describe("Burning", function () {
    it("Should allow burning tokens", async function () {
      // Add validator1 for signing
      await wrapper.addValidator(validator1.address);

      // First mint some tokens to user
      const mintAmount = ethers.parseEther("100");
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: mintAmount,
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures from validators
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await wrapper.mint(proof);

      // Now burn
      const burnAmount = ethers.parseEther("10");
      await expect(
        wrapper.connect(user).burn(
          burnAmount,
          "casper",
          "account-hash-abc123"
        )
      )
        .to.emit(wrapper, "AssetBurned")
        .withArgs(user.address, burnAmount, "casper", "account-hash-abc123", 0);

      expect(await wrapper.balanceOf(user.address)).to.equal(
        mintAmount - burnAmount
      );
    });

    it("Should reject burn below minimum", async function () {
      const mintAmount = ethers.parseEther("100");
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: mintAmount,
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures from validators
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await wrapper.mint(proof);

      const burnAmount = ethers.parseEther("0.5"); // Below MIN_BURN
      await expect(
        wrapper.connect(user).burn(
          burnAmount,
          "casper",
          "account-hash-abc123"
        )
      ).to.be.revertedWith("Amount below minimum");
    });

    it("Should increment nonce on burn", async function () {
      const mintAmount = ethers.parseEther("100");
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: mintAmount,
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures from validators
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await wrapper.mint(proof);

      await wrapper.connect(user).burn(
        ethers.parseEther("10"),
        "casper",
        "account-hash-abc123"
      );

      expect(await wrapper.nonce()).to.equal(1);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens with valid proof", async function () {
      const amount = ethers.parseEther("100");
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: amount,
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await expect(wrapper.mint(proof))
        .to.emit(wrapper, "AssetMinted")
        .withArgs(user.address, amount, "casper", "0xabc123", 0);

      expect(await wrapper.balanceOf(user.address)).to.equal(amount);
    });

    it("Should reject duplicate nonce", async function () {
      const amount = ethers.parseEther("100");
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: amount,
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await wrapper.mint(proof);

      // Try to mint again with same nonce
      await expect(wrapper.mint(proof)).to.be.revertedWith(
        "Proof already processed"
      );
    });

    it("Should reject insufficient signatures", async function () {
      const amount = ethers.parseEther("100");
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: amount,
        recipient: user.address,
        nonce: 1,
        validatorSignatures: [],
      };

      // Generate only 1 signature when 2 are required
      proof.validatorSignatures = await generateMintSignatures(proof, [owner]);

      await expect(wrapper.mint(proof)).to.be.revertedWith(
        "Insufficient validator signatures"
      );
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause", async function () {
      await wrapper.pause();
      // Try to mint - should fail when paused
      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: ethers.parseEther("100"),
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await expect(wrapper.mint(proof)).to.be.reverted;
    });

    it("Should allow owner to unpause", async function () {
      await wrapper.pause();
      await wrapper.unpause();

      const proof = {
        sourceChain: "casper",
        sourceTxHash: "0xabc123",
        amount: ethers.parseEther("100"),
        recipient: user.address,
        nonce: 0,
        validatorSignatures: [],
      };

      // Generate real signatures
      proof.validatorSignatures = await generateMintSignatures(proof, [owner, validator1]);

      await expect(wrapper.mint(proof)).to.not.be.reverted;
    });
  });
});
