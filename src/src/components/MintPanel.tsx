import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { encryptSecret } from '../utils/secretCrypto';
import '../styles/MintPanel.css';

type MintPanelProps = {
  onMinted: () => void;
};

export function MintPanel({ onMinted }: MintPanelProps) {
  const { address } = useAccount();
  const { instance, isLoading, error } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);

  const handleMint = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!address) {
      setStatus('Connect your wallet to mint.');
      return;
    }

    if (!instance || !signerPromise) {
      setStatus('Encryption service is not ready.');
      return;
    }

    const trimmed = secret.trim();
    if (!trimmed) {
      setStatus('Enter a secret before minting.');
      return;
    }

    setIsMinting(true);
    setStatus('Generating one-time key...');

    try {
      const randomWallet = Wallet.createRandom();
      setStatus('Encrypting your secret locally...');
      const encryptedSecret = await encryptSecret(trimmed, randomWallet.address);

      setStatus('Encrypting the key with FHE...');
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.addAddress(randomWallet.address);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer not available');
      }

      setStatus('Submitting mint transaction...');
      const secretMint = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await secretMint.mintSecret(
        encryptedSecret,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );
      await tx.wait();

      setStatus('Mint complete. Your secret is now sealed.');
      setSecret('');
      onMinted();
    } catch (mintError) {
      const message = mintError instanceof Error ? mintError.message : 'Mint failed';
      setStatus(message);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <section className="panel mint-panel">
      <header className="panel-header">
        <h3>Mint a Secret NFT</h3>
        <p>Create an encrypted secret and lock the key on-chain.</p>
      </header>

      <form className="mint-form" onSubmit={handleMint}>
        <label className="field-label" htmlFor="secret-input">
          Secret text
        </label>
        <textarea
          id="secret-input"
          className="secret-input"
          placeholder="Write something only you should unlock later."
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          maxLength={320}
          rows={5}
          required
        />
        <div className="hint-row">
          <span>{secret.trim().length}/320</span>
          <span>Encrypted client-side</span>
        </div>

        <button className="action-button primary" type="submit" disabled={isMinting || isLoading}>
          {isMinting ? 'Minting...' : 'Mint Secret NFT'}
        </button>

        <div className="status-row">
          {isLoading && <span>Loading encryption engine...</span>}
          {!isLoading && error && <span>{error}</span>}
          {!isLoading && status && <span>{status}</span>}
        </div>
      </form>
    </section>
  );
}
