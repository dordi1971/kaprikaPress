// app/admin/page.tsx
'use client'

import React, { useEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from 'react'

import { Client, type Identifier, type Signer as XmtpSigner } from '@xmtp/browser-sdk'
import { ethers } from 'ethers'


import { WalletButton } from '@/components/WalletButton'

import { useAccount } from 'wagmi'
import { PhotoUploader } from '@/components/PhotoUploader'




declare global {
    interface Window {
        ethereum?: any
    }
}



const ADMIN_WALLETS =
    (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? '')
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)

type CardRecord = {
    cardId: string
    wallet: string
    fullName: string
    role: string
    alias?: string | null

    email?: string | null
    phone?: string | null
    deliveryAddress?: string | null

    imageUrl: string
    pdfUrl: string
    txHash: string | null
    tokenId?: number | null

    issueDate: string
    expirationDate: string

    printed: boolean
    shipped: boolean
    delivered: boolean
    revoked: boolean

    createdAt: string
    updatedAt: string
}

export default function AdminPage() {
    const { address, isConnected, status } = useAccount()
    const isAdmin =
        status === 'connected' &&
        !!address &&
        ADMIN_WALLETS.includes(address.toLowerCase())


    const [cards, setCards] = useState<CardRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // selection for messaging
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [messageText, setMessageText] = useState('')
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)



    // create print-only modal
    const [showCreate, setShowCreate] = useState(false)
    const [createFirstName, setCreateFirstName] = useState('')
    const [createLastName, setCreateLastName] = useState('')
    const [createAlias, setCreateAlias] = useState('')
    const [createRole, setCreateRole] = useState('Journalist')
    const [createEmail, setCreateEmail] = useState('')
    const [createPhone, setCreatePhone] = useState('')
    const [createDelivery, setCreateDelivery] = useState('')
    const [createPhoto, setCreatePhoto] = useState<File | null>(null)
    const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null)
    const [messageSending, setMessageSending] = useState(false)
    const [sendError, setSendError] = useState<string | null>(null)

    // reuse one XMTP client per session
    const xmtpClientRef = useRef<Client | null>(null)


    async function getXmtpClient(): Promise<Client> {
        if (typeof window === 'undefined') {
            throw new Error('XMTP is only available in the browser')
        }

        if (xmtpClientRef.current) {
            return xmtpClientRef.current
        }

        const ethereum = (window as any).ethereum
        if (!ethereum) {
            throw new Error('MetaMask (or another injected wallet) is not available')
        }

        // Ethers v5 style provider
        const provider = new ethers.providers.Web3Provider(ethereum)
        await provider.send('eth_requestAccounts', [])
        const signer = provider.getSigner()
        const address = await signer.getAddress()

        const xmtpSigner: XmtpSigner = {
            type: 'EOA',
            getIdentifier: () => ({
                identifier: address,
                identifierKind: 'Ethereum',
            }),
            // XMTP expects raw bytes (Uint8Array)
            signMessage: async (message: string | Uint8Array): Promise<Uint8Array> => {
                const msg =
                    typeof message === 'string'
                        ? message
                        : ethers.utils.toUtf8String(message)
                const sigHex = await signer.signMessage(msg)
                return ethers.utils.arrayify(sigHex)
            },
        }

        const client = await Client.create(xmtpSigner, {
            appVersion: 'kaprika-press-id-admin/1.0.0',
            // you can also add env/network options later if you want
        })

        xmtpClientRef.current = client
        return client
    }


    useEffect(() => {
        if (!isAdmin) {
            setLoading(false)
            return
        }

        const load = async () => {
            try {
                setLoading(true)
                const res = await fetch('/api/admin/cards', { cache: 'no-store' })
                const data = await res.json()
                if (!res.ok || !data.ok) {
                    throw new Error(data.error || 'Failed to load cards')
                }
                setCards(data.cards)
            } catch (err: any) {
                setError(err.message ?? String(err))
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [isAdmin])

    const updateCardLocal = (cardId: string, patch: Partial<CardRecord>) => {
        setCards((prev) =>
            prev.map((c) => (c.cardId === cardId ? { ...c, ...patch } : c)),
        )
    }

    const handleToggleFlag = async (
        card: CardRecord,
        field: 'printed' | 'shipped' | 'delivered' | 'revoked',
        value: boolean,
    ) => {
        setSavingId(card.cardId)
        setError(null)
        const prev = card[field]

        updateCardLocal(card.cardId, { [field]: value } as any)

        try {
            const res = await fetch('/api/admin/cards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardId: card.cardId,
                    [field]: value,
                    tokenId: card.tokenId ?? null,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Update failed')
            }
            updateCardLocal(card.cardId, data.card)
        } catch (err: any) {
            updateCardLocal(card.cardId, { [field]: prev } as any)
            setError(err.message ?? String(err))
        } finally {
            setSavingId(null)
        }
    }

    const handleTokenIdChange = async (card: CardRecord, tokenIdStr: string) => {
        const tokenId =
            tokenIdStr.trim() === '' ? null : Number.parseInt(tokenIdStr, 10)
        if (Number.isNaN(tokenId as any)) return

        setSavingId(card.cardId)
        setError(null)
        const prev = card.tokenId ?? null
        updateCardLocal(card.cardId, { tokenId })

        try {
            const res = await fetch('/api/admin/cards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardId: card.cardId,
                    tokenId,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Update failed')
            }
            updateCardLocal(card.cardId, data.card)
        } catch (err: any) {
            updateCardLocal(card.cardId, { tokenId: prev })
            setError(err.message ?? String(err))
        } finally {
            setSavingId(null)
        }
    }

    const handleCopyWallet = (wallet: string) => {
        if (!wallet) return

        try {
            if (
                typeof navigator !== 'undefined' &&
                navigator.clipboard &&
                typeof navigator.clipboard.writeText === 'function'
            ) {
                navigator.clipboard.writeText(wallet)
            } else if (typeof document !== 'undefined') {
                // Fallback for environments without navigator.clipboard
                const textarea = document.createElement('textarea')
                textarea.value = wallet
                textarea.style.position = 'fixed'
                textarea.style.left = '-9999px'
                textarea.style.top = '-9999px'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
            }
        } catch (err) {
            console.error('Failed to copy wallet address:', err)
        }
    }


    const toggleSelected = (cardId: string, checked: boolean) => {
        setSelectedIds((prev) =>
            checked ? [...prev, cardId] : prev.filter((id) => id !== cardId),
        )
    }

    const handleSendMessage = async () => {
        console.log('[XMTP] handleSendMessage clicked')

        const trimmed = messageText.trim()
        if (!trimmed) {
            setError('Message cannot be empty.')
            console.warn('[XMTP] aborted: empty message')
            return
        }

        // only selected cards that actually have a wallet
        const targets = cards.filter(
            (card) => selectedIds.includes(card.cardId) && card.wallet
        )

        console.log('[XMTP] selectedIds =', selectedIds)
        console.log('[XMTP] targets =', targets)

        if (targets.length === 0) {
            setError(
                'No wallet addresses selected (print-only IDs have no wallet or you did not select any NFT ID).',
            )
            console.warn('[XMTP] aborted: no wallet targets')
            return
        }

        try {
            setMessageSending(true)
            setError(null)
            console.log('[XMTP] creating / reusing client…')

            const client = await getXmtpClient()

            console.log('[XMTP] client ready, building identifiers…')

            const identifiers = targets.map((card) => ({
                identifier: card.wallet!, // full 0x address
                identifierKind: 'Ethereum' as const,
            }))

            console.log('[XMTP] identifiers =', identifiers)

            // who is reachable on XMTP?
            const canMessageMap = await Client.canMessage(identifiers)
            const reachable = identifiers.filter((id) =>
                canMessageMap.get(id.identifier),
            )

            console.log('[XMTP] canMessageMap =', canMessageMap)
            console.log('[XMTP] reachable =', reachable)

            if (reachable.length === 0) {
                setError('None of the selected wallets are reachable on XMTP.')
                console.warn('[XMTP] aborted: no reachable identities')
                return
            }

            const failed: string[] = []
            const skippedNoDm: string[] = []

            for (const id of reachable) {
                console.log('[XMTP] opening DM for', id.identifier)
                const dm = await client.conversations.getDmByIdentifier(id)

                if (!dm) {
                    console.warn('[XMTP] no DM conversation for', id.identifier)
                    skippedNoDm.push(id.identifier)
                    continue
                }

                try {
                    await dm.send(trimmed)
                    console.log('[XMTP] sent to', id.identifier)
                } catch (err) {
                    console.error('[XMTP] failed to send to', id.identifier, err)
                    failed.push(id.identifier)
                }
            }

            // success: clear message + selection
            setMessageText('')
            setSelectedIds([])

            if (failed.length || skippedNoDm.length) {
                let msg = ''
                if (failed.length) {
                    msg += `Failed to send to: ${failed.join(', ')}. `
                }
                if (skippedNoDm.length) {
                    msg += `No DM found for: ${skippedNoDm.join(', ')}.`
                }
                if (msg) setError(msg)
            } else {
                // show a visible success message so it doesn't feel like "nothing happened"
                setError('Message sent successfully via XMTP.')
            }
        } catch (err: any) {
            console.error('[XMTP] unexpected send error:', err)
            setError(
                'Unexpected error while sending XMTP messages. Open the browser console for details.',
            )
        } finally {
            setMessageSending(false)
            console.log('[XMTP] handleSendMessage done')
        }
    }









    const handleCreateSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!createFirstName.trim() || !createLastName.trim() || !createPhoto) {
            setError('First name, last name and photo are required.')
            return
        }

        setSavingId('_create_')
        setError(null)

        try {
            const fd = new FormData()
            fd.append('firstName', createFirstName.trim())
            fd.append('lastName', createLastName.trim())
            fd.append('alias', createAlias.trim())
            fd.append('role', createRole.trim())
            fd.append('email', createEmail.trim())
            fd.append('phone', createPhone.trim())
            fd.append('deliveryAddress', createDelivery.trim())
            fd.append('photo', createPhoto)

            const res = await fetch('/api/admin/print-card', {
                method: 'POST',
                body: fd,
            })
            const data = await res.json()
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Failed to create card')
            }

            setCards((prev) => [data.card as CardRecord, ...prev])

            setShowCreate(false)
            setCreateFirstName('')
            setCreateLastName('')
            setCreateAlias('')
            setCreateRole('Journalist')
            setCreateEmail('')
            setCreatePhone('')
            setCreateDelivery('')
            setCreatePhoto(null)
        } catch (err: any) {
            setError(err.message ?? String(err))
        } finally {
            setSavingId(null)
        }
    }

    // ---- Gating states ----

    // ---- Gating states ----

    if (status === 'connecting' || status === 'reconnecting') {
        return (
            <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center border border-slate-700 rounded-xl p-4 bg-slate-900/70">
                    <h1 className="text-xl font-semibold mb-2">
                        Reconnecting your wallet…
                    </h1>
                    <p className="text-sm text-slate-300">
                        Please wait a moment while we restore the connection.
                    </p>
                </div>
            </main>
        )
    }

    if (!isConnected) {
        return (
            <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center border border-slate-700 rounded-xl p-4 bg-slate-900/70">
                    <h1 className="text-xl font-semibold mb-2">
                        Admin access – connect wallet
                    </h1>
                    <p className="text-sm text-slate-300 mb-3">
                        Connect your admin wallet to open the Kaprika Press ID dashboard.
                    </p>
                    <div className="flex justify-center">
                        <WalletButton />
                    </div>
                </div>
            </main>
        )
    }

    if (!isAdmin) {
        return (
            <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
                <div className="max-w-md text-center border border-slate-700 rounded-xl p-4 bg-slate-900/70">
                    <h1 className="text-xl font-semibold mb-2">
                        Admin access required
                    </h1>
                    <p className="text-sm text-slate-300">
                        This wallet is not in the administrators list. Update{' '}
                        <code>NEXT_PUBLIC_ADMIN_WALLETS</code> in your environment variables
                        to add it.
                    </p>
                </div>
            </main>
        )
    }


    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
                <p className="text-slate-300">Loading cards…</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-semibold">
                        Kaprika Press ID – Admin Dashboard
                    </h1>
                    <div className="text-xs text-slate-400">
                        Admin wallet:{' '}
                        <span className="font-mono">{address}</span>
                    </div>
                </header>

                {error && (
                    <div className="mb-4 rounded border border-red-500 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-3 py-1.5 rounded-md border border-emerald-400/60 text-emerald-200 text-sm hover:bg-emerald-500/10"
                    >
                        + Add print-only ID
                    </button>

                    <div className="flex items-center gap-2 mt-3">
                        <textarea
                            className="flex-1 min-h-[40px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            placeholder="Message to selected wallets…"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={messageSending || !messageText.trim() || selectedIds.length === 0}
                            className="px-3 py-1.5 rounded-md border border-blue-400/60 text-blue-200 text-xs hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {messageSending ? 'Sending…' : 'Send'}
                        </button>
                    </div>


                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-900/80">
                            <tr>
                                <th className="px-2 py-2 text-center text-xs">Sel</th>
                                <th className="px-3 py-2 text-left text-xs">Card ID</th>
                                <th className="px-3 py-2 text-left text-xs">Name</th>
                                <th className="px-3 py-2 text-left text-xs">Wallet</th>
                                <th className="px-3 py-2 text-left text-xs">PDF</th>
                                <th className="px-3 py-2 text-left text-xs">Token ID</th>
                                <th className="px-3 py-2 text-center text-xs">Printed</th>
                                <th className="px-3 py-2 text-center text-xs">Shipped</th>
                                <th className="px-3 py-2 text-center text-xs">Delivered</th>
                                <th className="px-3 py-2 text-center text-xs">Revoked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cards.map((card) => {
                                const isPrintOnly = !card.wallet
                                const isSelected = selectedIds.includes(card.cardId)
                                return (
                                    <tr
                                        key={card.cardId}
                                        className="border-t border-slate-800 odd:bg-slate-900/40"
                                    >
                                        <td className="px-2 py-2 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-emerald-400"
                                                checked={isSelected}
                                                onChange={(e) =>
                                                    toggleSelected(card.cardId, e.target.checked)
                                                }
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {card.cardId}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="font-medium">{card.fullName}</div>
                                            {card.role && (
                                                <div className="text-xs text-slate-400">
                                                    {card.role}
                                                    {card.alias ? ` (${card.alias})` : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            {isPrintOnly ? (
                                                <span className="text-xs text-slate-400">
                                                    Print version only
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-xs">
                                                        {card.wallet.slice(0, 6)}…
                                                        {card.wallet.slice(-4)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        title="Copy wallet"
                                                        onClick={() => handleCopyWallet(card.wallet)}
                                                        className="text-xs px-1 py-0.5 rounded border border-slate-600 hover:bg-slate-800"
                                                    >
                                                        📋
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <a
                                                href={card.pdfUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-300 underline text-xs"
                                            >
                                                PDF
                                            </a>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                className="w-20 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs"
                                                value={card.tokenId ?? ''}
                                                onChange={(e) =>
                                                    handleTokenIdChange(card, e.target.value)
                                                }
                                            />
                                        </td>
                                        {(['printed', 'shipped', 'delivered', 'revoked'] as const).map(
                                            (field) => (
                                                <td key={field} className="px-3 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 accent-emerald-400"
                                                        checked={card[field]}
                                                        disabled={savingId === card.cardId}
                                                        onChange={(e) =>
                                                            handleToggleFlag(card, field, e.target.checked)
                                                        }
                                                    />
                                                </td>
                                            ),
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                    Toggling <span className="font-semibold">Revoked</span> will also try
                    to call <code>setRevoked(tokenId, true)</code> on the Kaprika
                    contract if a Token ID is set. If no Token ID is set, only local
                    status is updated.
                </p>
            </div>

            {/* Create print-only modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <h2 className="text-lg font-semibold mb-3">
                            New print-only ID card
                        </h2>
                        <form className="space-y-3" onSubmit={handleCreateSubmit}>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    placeholder="First name"
                                    value={createFirstName}
                                    onChange={(e) => setCreateFirstName(e.target.value)}
                                />
                                <input
                                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                    placeholder="Last name"
                                    value={createLastName}
                                    onChange={(e) => setCreateLastName(e.target.value)}
                                />
                            </div>
                            <input
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                placeholder="Alias (optional)"
                                value={createAlias}
                                onChange={(e) => setCreateAlias(e.target.value)}
                            />
                            <input
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                                placeholder="Role"
                                value={createRole}
                                onChange={(e) => setCreateRole(e.target.value)}
                            />
                            <input
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                placeholder="Email (optional)"
                                value={createEmail}
                                onChange={(e) => setCreateEmail(e.target.value)}
                            />
                            <input
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                placeholder="Phone (optional)"
                                value={createPhone}
                                onChange={(e) => setCreatePhone(e.target.value)}
                            />
                            <textarea
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                                placeholder="Delivery address (optional)"
                                value={createDelivery}
                                onChange={(e) => setCreateDelivery(e.target.value)}
                            />
                            <div className="text-xs text-slate-300">
                                <label className="block mb-1">
                                    Photo (1:1 ratio, same as mint form)
                                </label>
                                <PhotoUploader
                                    label="ID photo"
                                    initialPreviewUrl={createPhotoPreview ?? undefined}
                                    onChange={(file, previewUrl) => {
                                        setCreatePhoto(file)
                                        setCreatePhotoPreview(previewUrl)
                                    }}
                                />
                            </div>


                            <div className="flex justify-end gap-2 mt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-3 py-1.5 rounded border border-slate-600 text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingId === '_create_'}
                                    className="px-3 py-1.5 rounded border border-emerald-400/70 text-emerald-200 text-xs hover:bg-emerald-500/10 disabled:opacity-40"
                                >
                                    Create card
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}
