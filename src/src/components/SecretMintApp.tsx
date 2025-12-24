import { useState } from 'react';
import { Header } from './Header';
import { MintPanel } from './MintPanel';
import { VaultPanel } from './VaultPanel';
import '../styles/SecretMintApp.css';

export function SecretMintApp() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="secret-mint-app">
      <Header />
      <main className="app-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-eyebrow">Encrypted NFTs</p>
            <h2 className="hero-title">Store secrets inside NFTs without exposing the key.</h2>
            <p className="hero-subtitle">
              Mint on Sepolia, protect your secret with FHE, and decrypt only when you allow it.
            </p>
            <div className="hero-badges">
              <span className="badge">Sepolia</span>
              <span className="badge badge-accent">FHEVM</span>
              <span className="badge">Owner-controlled access</span>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-content">
              <h3>How it works</h3>
              <ol>
                <li>We generate a one-time address key.</li>
                <li>Your secret is encrypted client-side.</li>
                <li>The key is stored with FHE permissions.</li>
              </ol>
            </div>
          </div>
        </section>

        <div className="panel-grid">
          <MintPanel onMinted={() => setRefreshKey((prev) => prev + 1)} />
          <VaultPanel refreshKey={refreshKey} />
        </div>
      </main>
    </div>
  );
}
