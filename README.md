# SecretMint

SecretMint is an ERC721 NFT that stores an encrypted secret alongside an FHE-protected key. Owners can selectively grant
decryption rights so specific viewers can recover the secret without exposing it publicly on-chain.

## Project Goals

- Let a user mint an NFT that embeds a secret without revealing plaintext on-chain.
- Use Zama FHEVM to control who can decrypt the key used to protect the secret.
- Provide a simple UI to mint, view owned NFTs, and decrypt only when permission is granted.
- Keep the cryptography and access rules explicit, auditable, and easy to reason about.

## Problem This Solves

Publishing a secret on-chain makes it permanently public. SecretMint allows users to:

- Store a secret permanently on-chain while keeping it encrypted.
- Grant decryption rights to a specific viewer without revealing the secret to everyone.
- Revoke trust by simply not granting additional decryption permissions.
- Maintain NFT ownership and transferability without exposing sensitive content.

## Advantages

- On-chain permanence with off-chain confidentiality.
- Owner-controlled access to decryption rights.
- FHE-protected key material avoids direct on-chain exposure.
- Simple, auditable ERC721 implementation without opaque metadata logic.
- Clear separation of concerns between encryption, permissioning, and storage.

## Key Features

- ERC721 minting with encrypted secret storage.
- FHE-encrypted key storage using Zama eaddress.
- Owner-only permission to allow a viewer to decrypt.
- Read-only function to fetch encrypted data for client-side decryption.
- Task scripts to mint and manage access from the CLI.

## Technology Stack

Smart contracts and tooling:
- Solidity 0.8.27
- Hardhat + hardhat-deploy
- Zama FHEVM Solidity library
- Ethers v6 (writes and tasks)

Frontend:
- React + Vite
- viem (read-only calls)
- ethers (write calls)
- RainbowKit + wagmi
- Zama relayer SDK for decryption flow

## How It Works

### Data Model

Each token stores:
- `encryptedSecret` (string): AES-256-GCM ciphertext, prefixed for parsing.
- `encryptedKey` (eaddress): FHE-encrypted EVM address used to derive the AES key.

The on-chain struct:
- `SecretData { string encryptedSecret; eaddress encryptedKey; }`

### Encryption Scheme

1. A random EVM address `A` is generated locally.
2. The AES key is derived as: `sha256("secretmint:" + lowercased(A))`.
3. The secret is encrypted with AES-256-GCM using a random 12-byte IV.
4. The ciphertext is encoded as:
   `sm1:<base64(iv)>:<base64(ciphertext||tag)>`.
5. The address `A` is encrypted with FHE into an `eaddress` and stored on-chain.

### Mint Flow

1. User inputs a secret in the UI or via CLI task.
2. A random address is generated and used to encrypt the secret locally.
3. The random address is FHE-encrypted (client side) and submitted to `mintSecret`.
4. The contract stores `(encryptedSecret, encryptedKey)` and emits `SecretMinted`.

### Access Flow

1. Token owner calls `allowSecretAccess(tokenId, viewer)`.
2. The contract calls `FHE.allow` on the encrypted key for the viewer address.
3. The viewer reads `getTokenSecret` and receives encrypted values.
4. The viewer uses the Zama relayer to decrypt the key, then decrypts the secret locally.

### Access Control

- Only the token owner can grant decryption rights.
- `getTokenSecret` never returns plaintext; it only returns encrypted data.
- Transfers move ownership but do not expose secrets automatically.

## Repository Structure

```
contracts/            Solidity contracts
deploy/               Hardhat deployment scripts
deployments/          Deployment artifacts (including ABI for frontend)
docs/                 Zama integration references
tasks/                Hardhat tasks for minting and access control
test/                 Contract tests
src/                  Frontend application (React + Vite)
```

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- A Sepolia RPC key (Infura) for deployment and verification
- A funded Sepolia account

### Install Dependencies

```bash
npm install
```

### Environment Configuration (Hardhat only)

Create a `.env` in the repository root:

```
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

Note:
- Deployment uses a private key (not a mnemonic).
- The frontend does not use environment variables.

### Compile and Test

```bash
npm run compile
npm run test
```

### Deploy Locally

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### CLI Tasks

```bash
# Print deployed address
npx hardhat task:address --network sepolia

# Mint with a secret
npx hardhat task:mint --secret "my secret" --network sepolia

# Allow a viewer to decrypt
npx hardhat task:allow --token-id 1 --viewer <address> --network sepolia
```

## Frontend Notes

- The UI is located in `src/`.
- Contract ABIs must be derived from `deployments/sepolia` and represented in frontend code.
- Reads use viem; writes use ethers.
- The UI targets Sepolia for on-chain interactions.

## Security Considerations

- If a viewer reveals the decrypted key, the secret can be shared with others.
- The encrypted secret is still stored on-chain; encryption must be performed correctly.
- Use distinct random addresses per mint to avoid key reuse.
- Do not reuse the same secret encryption key across tokens.

## Limitations

- `tokenURI` currently returns an empty string (no metadata server yet).
- Access is grant-only (no explicit revocation mechanism).
- Secrets are immutable once minted.
- No batch minting or batch access grants.

## Future Roadmap

- Metadata support and optional off-chain metadata hosting.
- Access revocation and time-limited decrypt permissions.
- Batch minting and batch access control.
- Multi-secret storage per token.
- UI improvements for key management and audit trails.
- Support for additional testnets and mainnet deployment.
- Optional on-chain events for audit-friendly access logs.

## License

BSD-3-Clause-Clear. See `LICENSE`.
