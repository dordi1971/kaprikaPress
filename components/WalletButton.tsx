// components/WalletButton.tsx
'use client'

import { useAppKit } from '@reown/appkit/react'
import { useAccount, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Connected state
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => open()}
          className="text-sm text-gray-200 hover:text-white transition"
        >
          <span className="text-gray-400 mr-2">Connected:</span>
          <span className="font-mono">{shortenAddress(address)}</span>
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 rounded-md border border-white/20 text-xs hover:bg-white/10 transition"
        >
          Disconnect
        </button>
      </div>
    )
  }

  // Disconnected state: Single "Connect Wallet" button invoking AppKit modal
  return (
    <button
      onClick={() => open()}
      className="px-4 py-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100 text-sm transition-colors"
    >
      Connect Wallet
    </button>
  )
}
