'use client'

import { ReactNode, useState } from 'react'
import { WagmiProvider, type State } from 'wagmi'
import { wagmiAdapter } from '@/lib/wagmiConfig'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function Providers({
  children,
  initialState
}: {
  children: ReactNode
  initialState?: State
}) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      initialState={initialState}
      reconnectOnMount={false}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
