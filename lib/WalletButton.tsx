// components/WalletButton.tsx
'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 rounded-md border border-slate-600 bg-slate-900 hover:bg-slate-800"
      >
        {address?.slice(0, 6)}…{address?.slice(-4)} – Disconnect
      </button>
    )
  }

  const injectedConnector = connectors[0]

  return (
    <button
      onClick={() => connect({ connector: injectedConnector })}
      disabled={isPending}
      className="px-4 py-2 rounded-md border border-slate-600 bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
    >
      {isPending ? 'Connecting…' : 'Connect MetaMask'}
    </button>
  )
}
