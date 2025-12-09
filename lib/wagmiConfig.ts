// lib/wagmiConfig.ts

import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { polygonAmoy } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'

// 1. Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Custom storage to allow cookies on HTTP (IP address)
const customCookieStorage = {
  getItem: (key: string) => {
    if (typeof document === 'undefined') return null
    const value = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'))
    return value ? decodeURIComponent(value[2]) : null
  },
  setItem: (key: string, value: string) => {
    if (typeof document === 'undefined') return
    // Force secure: false for IP testing. path=/ is critical.
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; SameSite=Lax; max-age=31536000`
  },
  removeItem: (key: string) => {
    if (typeof document === 'undefined') return
    document.cookie = `${key}=; path=/; max-age=0`
  },
}

export const networks = [polygonAmoy]

// 2. Set up Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: customCookieStorage
  }),
  ssr: true,
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
  networks: [polygonAmoy],
  projectId,
  metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})
