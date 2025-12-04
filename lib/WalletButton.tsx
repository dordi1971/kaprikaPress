// components/WalletButton.tsx
'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()

  // If already connected – show address + Disconnect
  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 rounded-md border bg-white/5 hover:bg-white/10 transition"
      >
        Connected: {shortenAddress(address)} (Disconnect)
      </button>
    )
  }

  // Use the connectors we configured in createConfig:
  // connectors: [injected(), walletConnect({ ... })]
  const injectedConnector =
    connectors.find((c) => c.id === 'injected') ?? connectors[0]

  const walletConnectConnector =
    connectors.find((c) => c.id === 'walletConnect') ?? connectors[1]

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {injectedConnector && (
        <button
          onClick={() => connect({ connector: injectedConnector })}
          disabled={isPending}
          className="px-4 py-2 rounded-md border bg-white/5 hover:bg-white/10 transition disabled:opacity-60"
        >
          {isPending ? 'Connecting…' : 'Connect MetaMask (browser)'}
        </button>
      )}

      {walletConnectConnector && (
        <button
          onClick={() => connect({ connector: walletConnectConnector })}
          disabled={isPending}
          className="px-4 py-2 rounded-md border bg-white/5 hover:bg-white/10 transition disabled:opacity-60"
        >
          {isPending ? 'Connecting…' : 'Connect mobile wallet'}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-500 max-w-xs">
          {error.message || 'Failed to connect'}
        </p>
      )}
    </div>
  )
}
