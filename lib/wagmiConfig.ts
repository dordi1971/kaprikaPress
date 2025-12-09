// lib/wagmiConfig.ts

import { http, createConfig } from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { injected, walletConnect, metaMask } from 'wagmi/connectors'


const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID
const myurl = process.env.NEXT_PUBLIC_APP_BASE_URL

if (!projectId) {
  throw new Error(
    'NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Please add it to your .env.local'
  )
}

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [
    // 0) MetaMask SDK – handles extension & mobile app
    metaMask({
      dappMetadata: {
        name: 'Kaprika Press ID',
        // url is optional; defaults to window.location.origin on the client
      },
    }),

    // 1) Generic injected wallets (Browser Wallet)
    injected(),

    // 2) WalletConnect / Reown – for non-MetaMask mobile wallets, QR on desktop
    walletConnect({
      projectId,
      showQrModal: true,
    }),
  ],

  transports: {
    [polygonAmoy.id]: http(), // change to custom RPC if/when you want
  },
  ssr: true,
})
