import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SecretMint, SecretMint__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecretMint")) as SecretMint__factory;
  const secretMint = (await factory.deploy()) as SecretMint;
  const secretMintAddress = await secretMint.getAddress();

  return { secretMint, secretMintAddress };
}

describe("SecretMint", function () {
  let signers: Signers;
  let secretMint: SecretMint;
  let secretMintAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ secretMint, secretMintAddress } = await deployFixture());
  });

  it("mints and stores encrypted data", async function () {
    const encryptedSecret = "sm1:ZmFrZUl2:ZmFrZUNpcGhlcnRleHQ=";
    const randomAddress = ethers.Wallet.createRandom().address;

    const encryptedInput = await fhevm
      .createEncryptedInput(secretMintAddress, signers.alice.address)
      .addAddress(randomAddress)
      .encrypt();

    const tx = await secretMint
      .connect(signers.alice)
      .mintSecret(encryptedSecret, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    expect(await secretMint.ownerOf(1)).to.eq(signers.alice.address);

    const tokens = await secretMint.tokensOfOwner(signers.alice.address);
    expect(tokens.length).to.eq(1);
    expect(tokens[0]).to.eq(1n);

    const data = await secretMint.getTokenSecret(1);
    expect(data[0]).to.eq(encryptedSecret);
    expect(data[1]).to.not.eq(ethers.ZeroHash);
  });

  it("only owner can allow decryption", async function () {
    const encryptedSecret = "sm1:another:payload";
    const randomAddress = ethers.Wallet.createRandom().address;

    const encryptedInput = await fhevm
      .createEncryptedInput(secretMintAddress, signers.alice.address)
      .addAddress(randomAddress)
      .encrypt();

    await secretMint
      .connect(signers.alice)
      .mintSecret(encryptedSecret, encryptedInput.handles[0], encryptedInput.inputProof);

    await expect(secretMint.connect(signers.bob).allowSecretAccess(1, signers.bob.address)).to.be.revertedWith(
      "Only token owner",
    );
    await expect(secretMint.connect(signers.alice).allowSecretAccess(1, signers.bob.address)).to.not.be.reverted;
  });
});
