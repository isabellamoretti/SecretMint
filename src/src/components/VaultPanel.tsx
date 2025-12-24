import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient, useReadContract, useReadContracts } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { decryptSecret } from '../utils/secretCrypto';
import '../styles/VaultPanel.css';

type VaultPanelProps = {
  refreshKey: number;
};

type TokenView = {
  tokenId: bigint;
  encryptedSecret?: string;
  encryptedKey?: string;
};

export function VaultPanel({ refreshKey }: VaultPanelProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance } = useZamaInstance();

  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [tokenMessages, setTokenMessages] = useState<Record<string, string>>({});
  const [decryptedSecrets, setDecryptedSecrets] = useState<Record<string, string>>({});

  const {
    data: tokenIdsData,
    isLoading: tokenIdsLoading,
    refetch: refetchTokenIds,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    if (refreshKey > 0) {
      refetchTokenIds();
    }
  }, [refreshKey, refetchTokenIds]);

  const tokenIds = useMemo(() => {
    if (!tokenIdsData || !Array.isArray(tokenIdsData)) {
      return [];
    }
    return tokenIdsData as bigint[];
  }, [tokenIdsData]);

  const tokenContracts = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTokenSecret',
        args: [tokenId],
      })),
    [tokenIds],
  );

  const { data: tokenSecretData } = useReadContracts({
    contracts: tokenContracts,
    query: {
      enabled: tokenContracts.length > 0,
    },
  });

  const tokens = useMemo<TokenView[]>(() => {
    return tokenIds.map((tokenId, index) => {
      const result = tokenSecretData?.[index]?.result as [string, string] | undefined;
      return {
        tokenId,
        encryptedSecret: result?.[0],
        encryptedKey: result?.[1],
      };
    });
  }, [tokenIds, tokenSecretData]);

  const setMessage = (tokenId: bigint, message: string) => {
    setTokenMessages((prev) => ({ ...prev, [tokenId.toString()]: message }));
  };

  const handleDecrypt = async (token: TokenView) => {
    if (!address) {
      return;
    }

    if (!instance) {
      setMessage(token.tokenId, 'Encryption service is not ready.');
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      setMessage(token.tokenId, 'Signer not available.');
      return;
    }

    setActiveTokenId(token.tokenId.toString());
    setMessage(token.tokenId, 'Preparing decryption...');

    try {
      let encryptedSecret = token.encryptedSecret;
      let encryptedKey = token.encryptedKey;

      if ((!encryptedSecret || !encryptedKey) && publicClient) {
        const data = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getTokenSecret',
          args: [token.tokenId],
        })) as [string, string];
        encryptedSecret = data[0];
        encryptedKey = data[1];
      }

      if (!encryptedSecret || !encryptedKey) {
        throw new Error('Token data unavailable');
      }

      setMessage(token.tokenId, 'Granting decryption access...');
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const allowTx = await contract.allowSecretAccess(token.tokenId, address);
      await allowTx.wait();

      setMessage(token.tokenId, 'Requesting decryption...');
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: encryptedKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedAddress = result[encryptedKey];
      if (!decryptedAddress) {
        throw new Error('Decryption response missing key');
      }

      const secret = await decryptSecret(encryptedSecret, decryptedAddress);
      setDecryptedSecrets((prev) => ({ ...prev, [token.tokenId.toString()]: secret }));
      setMessage(token.tokenId, 'Decryption complete.');
    } catch (decryptError) {
      const message = decryptError instanceof Error ? decryptError.message : 'Decryption failed';
      setMessage(token.tokenId, message);
    } finally {
      setActiveTokenId(null);
    }
  };

  return (
    <section className="panel vault-panel">
      <header className="panel-header">
        <h3>Your Secret Vault</h3>
        <p>Decrypt any secret after granting access to yourself.</p>
      </header>

      {!address && <div className="empty-state">Connect your wallet to view your NFTs.</div>}

      {address && tokenIdsLoading && <div className="empty-state">Loading your tokens...</div>}

      {address && !tokenIdsLoading && tokens.length === 0 && (
        <div className="empty-state">No SecretMint NFTs yet. Mint one to get started.</div>
      )}

      {address && tokens.length > 0 && (
        <div className="token-list">
          {tokens.map((token) => {
            const tokenId = token.tokenId.toString();
            const decrypted = decryptedSecrets[tokenId];
            return (
              <article className="token-card" key={tokenId}>
                <div className="token-card-header">
                  <div>
                    <p className="token-label">Token ID</p>
                    <h4>#{tokenId}</h4>
                  </div>
                  <span className="token-status">
                    {decrypted ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                <div className="token-body">
                  <p className="token-label">Encrypted payload</p>
                  <p className="token-value">
                    {token.encryptedSecret ? `${token.encryptedSecret.slice(0, 24)}...` : 'Loading...'}
                  </p>
                  <p className="token-label">Decrypted secret</p>
                  <p className="token-value highlight">
                    {decrypted ? decrypted : 'Not decrypted yet.'}
                  </p>
                </div>
                <div className="token-actions">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => handleDecrypt(token)}
                    disabled={activeTokenId === tokenId}
                  >
                    {activeTokenId === tokenId ? 'Decrypting...' : 'Allow & Decrypt'}
                  </button>
                  <span className="token-message">{tokenMessages[tokenId]}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
