import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SecretMint',
  projectId: 'f35d8f2a7c2b4f1a9e78c8f9d2d5e3a1',
  chains: [sepolia],
  ssr: false,
});
