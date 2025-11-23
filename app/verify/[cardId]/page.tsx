// app/verify/[cardId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type CardRecord = {
    cardId: string
    wallet: string
    fullName: string
    role: string
    alias?: string | null
    pdfUrl: string
    issueDate: string
    expirationDate: string
    printed: boolean
    shipped: boolean
    delivered: boolean
    revoked: boolean
}

export default function VerifyPage() {
    const params = useParams()
    const raw = (params as any).cardId
    const cardId =
        typeof raw === 'string'
            ? raw
            : Array.isArray(raw) && raw.length > 0
                ? raw[0]
                : ''

    const [card, setCard] = useState<CardRecord | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!cardId) {
            setLoading(false)
            setError('Invalid card ID')
            return
        }

        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await fetch(`/api/card/${encodeURIComponent(cardId)}`)
                const data = await res.json()
                if (!res.ok || !data.ok) {
                    throw new Error(data.error || 'Card not found')
                }
                setCard(data.card as CardRecord)
            } catch (err: any) {
                setError(err.message ?? String(err))
                setCard(null)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [cardId])

    const today = new Date()
    const isExpired =
        card && card.expirationDate
            ? new Date(card.expirationDate) < today
            : false

    const isPrintOnly = card && !card.wallet

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
            <div className="max-w-xl w-full border border-slate-700 rounded-xl p-6 bg-slate-900/60">
                <h1 className="text-2xl font-semibold mb-4">
                    Kaprika Press ID Verification
                </h1>

                <p className="text-sm text-slate-300 mb-3">
                    Card ID:{' '}
                    <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                        {cardId || 'Unknown'}
                    </span>
                </p>

                {loading && (
                    <p className="text-sm text-slate-300">Checking card…</p>
                )}

                {!loading && error && (
                    <p className="text-sm text-red-300">
                        {error || 'Card not found.'}
                    </p>
                )}

                {!loading && !error && card && (
                    <div className="space-y-3 mt-3">
                        <div>
                            <div className="text-xs text-slate-400 uppercase">
                                Name
                            </div>
                            <div className="text-lg font-semibold">
                                {card.fullName}
                            </div>
                            {card.alias && (
                                <div className="text-xs text-slate-400">
                                    Alias: “{card.alias}”
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-xs text-slate-400 uppercase">
                                Role
                            </div>
                            <div className="text-sm">{card.role}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-slate-400 uppercase">
                                    Issue / Expires
                                </div>
                                <div className="text-xs">
                                    {card.issueDate} → {card.expirationDate}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-400 uppercase">
                                    Type
                                </div>
                                <div className="text-xs">
                                    {isPrintOnly ? 'Print-only ID' : 'On-chain NFT ID'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-slate-400 uppercase">
                                Wallet
                            </div>
                            {isPrintOnly ? (
                                <div className="text-xs text-slate-400">
                                    Print version only (no wallet associated)
                                </div>
                            ) : (
                                <div className="font-mono text-xs break-all">
                                    {card.wallet}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                            <StatusBadge
                                label={card.revoked ? 'Revoked' : 'Active'}
                                tone={card.revoked ? 'red' : 'emerald'}
                            />
                            <StatusBadge
                                label={isExpired ? 'Expired' : 'Valid date'}
                                tone={isExpired ? 'yellow' : 'sky'}
                            />
                            {card.printed && (
                                <StatusBadge label="Printed" tone="slate" />
                            )}
                            {card.shipped && (
                                <StatusBadge label="Shipped" tone="slate" />
                            )}
                            {card.delivered && (
                                <StatusBadge label="Delivered" tone="slate" />
                            )}
                        </div>

                        <div className="mt-3 text-xs text-slate-400">
                            For additional confirmation, contact the Kaprika editorial
                            office and provide this Card ID. In future versions this page
                            will also show on-chain validation of the NFT.
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}

function StatusBadge({
    label,
    tone,
}: {
    label: string
    tone: 'red' | 'emerald' | 'yellow' | 'sky' | 'slate'
}) {
    const colors: Record<typeof tone, string> = {
        red: 'bg-red-900/60 border-red-500/70 text-red-100',
        emerald: 'bg-emerald-900/40 border-emerald-500/70 text-emerald-100',
        yellow: 'bg-yellow-900/40 border-yellow-500/70 text-yellow-100',
        sky: 'bg-sky-900/40 border-sky-500/70 text-sky-100',
        slate: 'bg-slate-800/60 border-slate-500/70 text-slate-100',
    } as any

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${colors[tone]}`}
        >
            {label}
        </span>
    )
}
