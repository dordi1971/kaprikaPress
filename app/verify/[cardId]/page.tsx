import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type CardData = {
    cardId: string
    wallet: string
    firstName: string
    lastName: string
    alias?: string | null
    role: string
    country?: string | null
    city?: string | null
    email?: string | null
    phone?: string | null
    imageUrl: string
    pdfUrl: string
    verificationUrl: string
    tokenURI: string
    issueDate: string
    expirationDate: string
    txHash?: string | null
    tokenContract?: string | null
    createdAt: string
    updatedAt: string
}

async function fetchCard(cardId: string): Promise<CardData | null> {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/card/${cardId}`, {
        cache: 'no-store',
    })

    if (!res.ok) return null
    return res.json()
}

export default async function VerifyPage({
    params,
}: {
    params: Promise<{ cardId: string }>
}) {
    const resolved = await params
    const cardIdFromParams = resolved.cardId

    const card = await fetchCard(cardIdFromParams)

    if (!card) {
        notFound()
    }


    const {
        cardId,
        wallet,
        firstName,
        lastName,
        alias,
        role,
        country,
        city,
        email,
        phone,
        imageUrl,
        pdfUrl,
        issueDate,
        expirationDate,
        tokenContract,
    } = card

    const fullName = `${firstName} ${lastName}`.trim()

    const scannerBase =
        process.env.NEXT_PUBLIC_POLYGONSCAN_BASE ??
        'https://amoy.polygonscan.com'

    const contractUrl =
        tokenContract && `${scannerBase}/address/${tokenContract}`

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-4xl bg-slate-900/80 border border-slate-700 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                            Kaprika Press ID Verification
                        </h1>
                        <p className="text-sm text-slate-300 mt-1">
                            Card ID{' '}
                            <span className="font-mono text-slate-200">{cardId}</span>
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/60 text-emerald-200 text-xs md:text-sm">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Kaprika Press ID found and verified
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 md:gap-8">
                    {/* Card image */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-slate-200 uppercase tracking-[0.18em]">
                            Card Preview
                        </h2>
                        <div className="relative w-full aspect-[85.6/54] bg-slate-800/80 rounded-xl overflow-hidden border border-slate-700">
                            {imageUrl ? (
                                <Image
                                    src={imageUrl}
                                    alt={`Kaprika Press ID card ${cardId}`}
                                    fill
                                    sizes="(min-width: 1024px) 60vw, 100vw"
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                                    No card image available
                                </div>
                            )}
                        </div>

                        {pdfUrl && (
                            <Link
                                href={pdfUrl}
                                target="_blank"
                                className="inline-flex items-center text-xs text-sky-300 hover:text-sky-200 underline underline-offset-4"
                            >
                                Download print-ready PDF
                            </Link>
                        )}
                    </section>

                    {/* Details */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-sm font-medium text-slate-200 uppercase tracking-[0.18em]">
                                Card Holder
                            </h2>
                            <div className="mt-2 space-y-1.5">
                                <p className="text-lg font-semibold">
                                    {fullName || 'Unknown holder'}
                                </p>
                                {alias && (
                                    <p className="text-sm text-slate-300">
                                        Alias:{' '}
                                        <span className="font-medium">{alias}</span>
                                    </p>
                                )}
                                {role && (
                                    <p className="text-sm text-slate-300">
                                        Role:{' '}
                                        <span className="font-medium">{role}</span>
                                    </p>
                                )}
                                {(country || city) && (
                                    <p className="text-sm text-slate-300">
                                        Location:{' '}
                                        <span className="font-medium">
                                            {[city, country].filter(Boolean).join(', ')}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-slate-700 pt-3 space-y-1.5 text-xs">
                            {wallet && (
                                <p className="text-slate-300">
                                    Owner wallet:{' '}
                                    <span className="font-mono text-slate-100 break-all">
                                        {wallet}
                                    </span>
                                </p>
                            )}
                            {email && (
                                <p className="text-slate-300">
                                    Email:{' '}
                                    <span className="font-mono text-slate-100 break-all">
                                        {email}
                                    </span>
                                </p>
                            )}
                            {phone && (
                                <p className="text-slate-300">
                                    Phone:{' '}
                                    <span className="font-mono text-slate-100 break-all">
                                        {phone}
                                    </span>
                                </p>
                            )}
                            <p className="text-slate-400">
                                Issued:{' '}
                                <span className="font-mono">
                                    {issueDate}
                                </span>
                            </p>
                            <p className="text-slate-400">
                                Expires:{' '}
                                <span className="font-mono">
                                    {expirationDate}
                                </span>
                            </p>
                        </div>

                        {/* Blockchain section */}
                        <div className="border-t border-slate-700 pt-3 space-y-1.5 text-xs">
                            <h3 className="text-[0.7rem] font-semibold text-slate-200 uppercase tracking-[0.2em] mb-1">
                                On-chain details
                            </h3>

                            {tokenContract && (
                                <p className="text-slate-300">
                                    Contract:{' '}
                                    {contractUrl ? (
                                        <Link
                                            href={contractUrl}
                                            target="_blank"
                                            className="font-mono text-sky-300 hover:text-sky-200 break-all underline underline-offset-2"
                                        >
                                            {tokenContract}
                                        </Link>
                                    ) : (
                                        <span className="font-mono break-all">
                                            {tokenContract}
                                        </span>
                                    )}
                                </p>
                            )}

                            <p className="text-[0.7rem] text-slate-500 mt-2">
                                This page confirms that the QR code matches a Kaprika Press ID
                                stored in the official registry. On-chain ownership can be
                                verified independently via the blockchain explorer.
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    )
}
