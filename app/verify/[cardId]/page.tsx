// app/verify/[cardId]/page.tsx
'use client'

import { useParams } from 'next/navigation'

export default function VerifyPage() {
    const params = useParams()
    const raw = (params as any).cardId
    const cardId =
        typeof raw === 'string'
            ? raw
            : Array.isArray(raw) && raw.length > 0
                ? raw[0]
                : 'Unknown ID'

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
            <div className="max-w-xl w-full border border-slate-700 rounded-xl p-6 bg-slate-900/60">
                <h1 className="text-2xl font-semibold mb-4">
                    Kaprika Press ID Verification
                </h1>

                <p className="text-sm text-slate-300 mb-3">
                    Card ID:{' '}
                    <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                        {cardId}
                    </span>
                </p>

                <p className="text-sm text-slate-200 mb-3">
                    This page confirms that the QR code you scanned belongs to the
                    Kaprika Press ID system and uses a valid card identifier.
                </p>

                <p className="text-xs text-slate-400">
                    Full automatic verification (on-chain token, revocation status,
                    holder&apos;s wallet, printing and delivery info, etc.) is not enabled yet.
                    If you need to verify the authenticity of this card, please contact the
                    Kaprika editorial office and mention this Card ID.
                </p>
            </div>
        </main>
    )
}
