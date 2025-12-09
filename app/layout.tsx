// app/layout.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { cookieToInitialState } from 'wagmi'
import { wagmiAdapter } from '@/lib/wagmiConfig'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Kaprika Press ID',
  description: 'Mint your Kaprika Press ID card as an NFT.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig,
    headersList.get('cookie')
  )

  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  )
}
