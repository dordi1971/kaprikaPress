// lib/wagmiConfig.ts

import { http, createConfig } from 'wagmi'
import { mainnet, optimism, polygonAmoy } from 'wagmi/chains' // Add your specific chains (Kaprika?)
import { injected, walletConnect } from 'wagmi/connectors'

// Replace this with the ID you got in Step 1
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!projectId) {
  throw new Error(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Please add it to your .env.local'
  )
}

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [
    // 1) Browser / injected wallets (MetaMask extension, MetaMask in-app browser, etc.)
    injected(),

    // 2) WalletConnect – for mobile wallets (MetaMask mobile, Rainbow, Trust Wallet, etc.)
    walletConnect({
      projectId,
      // showQrModal true => QR on desktop, deep-link list on mobile
      showQrModal: true,
    }),
  ],
  transports: {
    [polygonAmoy.id]: http(), // you can still swap this for your own RPC
  },
  ssr: true,
})
