import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SecretMint } from "../types";
import { expect } from "chai";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SecretMintSepolia", function () {
  let signers: Signers;
  let secretMint: SecretMint;
  let secretMintAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const secretMintDeployment = await deployments.get("SecretMint");
      secretMintAddress = secretMintDeployment.address;
      secretMint = await ethers.getContractAt("SecretMint", secretMintDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("mints a token and reads it back", async function () {
    steps = 8;
    this.timeout(4 * 40000);

    const encryptedSecret = "sm1:sepolia:test";
    const randomAddress = ethers.Wallet.createRandom().address;

    progress("Encrypting random address...");
    const encryptedInput = await fhevm
      .createEncryptedInput(secretMintAddress, signers.alice.address)
      .addAddress(randomAddress)
      .encrypt();

    progress("Minting SecretMint token...");
    const tx = await secretMint
      .connect(signers.alice)
      .mintSecret(encryptedSecret, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    progress("Reading tokens of owner...");
    const tokens = await secretMint.tokensOfOwner(signers.alice.address);
    expect(tokens.length).to.be.greaterThan(0);
    const tokenId = tokens[tokens.length - 1];

    progress("Reading encrypted payload...");
    const data = await secretMint.getTokenSecret(tokenId);
    expect(data[0]).to.eq(encryptedSecret);
    expect(data[1]).to.not.eq(ethers.ZeroHash);
  });
});
