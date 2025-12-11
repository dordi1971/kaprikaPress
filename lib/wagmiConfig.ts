// lib/wagmiConfig.ts

import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { polygon } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'

// 1. Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// 2. Set up Wagmi Adapter
export const networks = [polygon]

export const wagmiAdapter = new WagmiAdapter({
  // storage: createStorage({ storage: cookieStorage }), // SSR disabled for IP compatibility
  ssr: false,
  projectId,
  networks
})

// 3. Configure the adapter
export const config = wagmiAdapter.wagmiConfig

// 4. Create the modal
const url = typeof window !== 'undefined' ? window.location.origin : 'https://kaprika.press'

export const metadata = {
  name: 'Kaprika Press ID',
  description: 'Mint your Kaprika Press ID',
  url,
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

createAppKit({
  adapters: [wagmiAdapter],
  networks: [polygon],
  projectId,
  metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})
