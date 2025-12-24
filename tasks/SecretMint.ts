import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const SECRET_PREFIX = "sm1";

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function encryptSecret(secret: string, addressKey: string): string {
  const normalized = addressKey.toLowerCase();
  const key = createHash("sha256").update(`secretmint:${normalized}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${SECRET_PREFIX}:${encodeBase64(iv)}:${encodeBase64(ciphertext)}`;
}

task("task:address", "Prints the SecretMint address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const secretMint = await deployments.get("SecretMint");
  console.log("SecretMint address is " + secretMint.address);
});

task("task:mint", "Mints a SecretMint NFT")
  .addParam("secret", "The secret string to encrypt and store")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const secretMintDeployment = await deployments.get("SecretMint");
    const signer = (await ethers.getSigners())[0];
    const secretMint = await ethers.getContractAt("SecretMint", secretMintDeployment.address);

    const randomWallet = ethers.Wallet.createRandom();
    const encryptedSecret = encryptSecret(taskArguments.secret, randomWallet.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(secretMintDeployment.address, signer.address)
      .addAddress(randomWallet.address)
      .encrypt();

    console.log("Random key address:", randomWallet.address);
    const tx = await secretMint
      .connect(signer)
      .mintSecret(encryptedSecret, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:allow", "Allows an address to decrypt a token's key")
  .addParam("tokenId", "Token ID to grant access to")
  .addOptionalParam("viewer", "Address to allow (defaults to signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const secretMintDeployment = await deployments.get("SecretMint");
    const signer = (await ethers.getSigners())[0];
    const viewer = taskArguments.viewer ?? signer.address;
    const secretMint = await ethers.getContractAt("SecretMint", secretMintDeployment.address);

    const tx = await secretMint.connect(signer).allowSecretAccess(taskArguments.tokenId, viewer);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });
