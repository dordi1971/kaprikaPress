// components/WalletButton.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import type { Connector } from 'wagmi'

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, status, error } = useConnect()
  const { disconnect } = useDisconnect()

  const [connectingId, setConnectingId] = useState<string | null>(null)
  const isPending = status === 'pending'
  const isMobile = isMobileDevice()

  const metaMaskConnector = connectors.find((c) => c.id === 'metaMask')
  const injectedConnector = connectors.find((c) => c.id === 'injected')
  const walletConnectConnector = connectors.find((c) => c.id === 'walletConnect')

  const handleConnect = (connector: Connector) => {
    setConnectingId(connector.id)
    connect({ connector })
  }

  // When wagmi finishes (success or error), clear local "connecting" flag
  useEffect(() => {
    if (status !== 'pending') {
      setConnectingId(null)
    }
  }, [status])

  // Connected state
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-200">
          Connected:{' '}
          <span className="font-mono">{shortenAddress(address)}</span>
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 rounded-md border border-white/20 text-xs hover:bg-white/10 transition"
        >
          Disconnect
        </button>
      </div>
    )
  }

  if (!connectors.length) {
    return (
      <p className="text-sm text-red-400">
        No wallet connectors available. Check your wagmi config.
      </p>
    )
  }

  const isMetaMaskPending =
    isPending && connectingId && connectingId === metaMaskConnector?.id
  const isInjectedPending =
    isPending && connectingId && connectingId === injectedConnector?.id
  const isWalletConnectPending =
    isPending && connectingId && connectingId === walletConnectConnector?.id

  return (
    <div className="flex flex-col gap-2 items-start">
      {/* MetaMask (SDK – handles extension + mobile app) */}
      {metaMaskConnector && (
        <button
          onClick={() => handleConnect(metaMaskConnector as Connector)}
          disabled={isPending && !isMetaMaskPending}
          className="px-4 py-2 rounded-md border border-white/30 bg-white/5 hover:bg-white/10 text-sm disabled:opacity-60"
        >
          {isMetaMaskPending ? 'Connecting…' : 'Connect MetaMask'}
        </button>
      )}

      {/* Generic browser wallet (if any injected provider other than MetaMask) */}
      {injectedConnector && injectedConnector !== metaMaskConnector && (
        <button
          onClick={() => handleConnect(injectedConnector as Connector)}
          disabled={isPending && !isInjectedPending}
          className="px-4 py-2 rounded-md border border-white/20 bg-transparent hover:bg-white/5 text-xs disabled:opacity-60"
        >
          {isInjectedPending ? 'Connecting…' : 'Connect browser wallet'}
        </button>
      )}

      {/* WalletConnect / Reown – QR on desktop, deep links on mobile */}
      {walletConnectConnector && (
        <button
          onClick={() => handleConnect(walletConnectConnector as Connector)}
          disabled={isPending && !isWalletConnectPending}
          className="px-4 py-2 rounded-md border border-white/20 bg-transparent hover:bg-white/5 text-xs disabled:opacity-60"
        >
          {isWalletConnectPending
            ? 'Connecting…'
            : isMobile
              ? 'Connect mobile wallet'
              : 'Connect mobile wallet (QR)'}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-400 max-w-xs">
          {error.message || 'Failed to connect'}
        </p>
      )}
    </div>
  )
}
