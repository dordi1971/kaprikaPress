'use client'

import { useState, FormEvent } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import {
    kaprikaPressIdAbi,
    KAPRIKA_PRESS_ID_ADDRESS,
} from '@/lib/kaprikaAbi'
import { WalletButton } from '@/components/WalletButton'

export default function AmbassadorAdminPage() {
    const { address, isConnected } = useAccount()
    const { writeContractAsync } = useWriteContract()

    const [ambassadorAddress, setAmbassadorAddress] = useState('')
    const [commissionPercentInput, setCommissionPercentInput] =
        useState<string>('25')

    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const {
        data: commissionBpsRaw,
        isLoading: isBpsLoading,
        error: bpsError,
        refetch: refetchBps,
    } = useReadContract({
        address: KAPRIKA_PRESS_ID_ADDRESS,
        abi: kaprikaPressIdAbi,
        functionName: 'ambassadorCommissionBps',
    })

    const currentCommissionPercent = (() => {
        const bps = (commissionBpsRaw as bigint | undefined) ?? 0n
        return Number(bps) / 100 // 2500 -> 25.00
    })()

    const resetMessages = () => {
        setStatusMessage(null)
        setErrorMessage(null)
    }

    const handleSetAmbassador = async (active: boolean) => {
        resetMessages()

        if (!ambassadorAddress || !ambassadorAddress.startsWith('0x')) {
            setErrorMessage('Please enter a valid Ethereum address.')
            return
        }

        setIsSubmitting(true)

        try {
            const hash = await writeContractAsync({
                address: KAPRIKA_PRESS_ID_ADDRESS,
                abi: kaprikaPressIdAbi,
                functionName: 'setAmbassador',
                args: [ambassadorAddress as `0x${string}`, active],
            })

            setStatusMessage(
                `Transaction sent: ${hash}. The ambassador list will update once confirmed.`
            )
        } catch (err: any) {
            console.error(err)
            const msg =
                err?.message?.toString() ??
                'Something went wrong while updating ambassador status.'
            setErrorMessage(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSetCommission = async (e: FormEvent) => {
        e.preventDefault()
        resetMessages()

        const p = Number(commissionPercentInput)
        if (Number.isNaN(p) || p < 0 || p > 100) {
            setErrorMessage('Commission must be between 0 and 100 percent.')
            return
        }

        const bps = Math.round(p * 100) // 25% -> 2500

        setIsSubmitting(true)

        try {
            const hash = await writeContractAsync({
                address: KAPRIKA_PRESS_ID_ADDRESS,
                abi: kaprikaPressIdAbi,
                functionName: 'setAmbassadorCommissionBps',
                args: [bps],
            })

            setStatusMessage(
                `Commission update transaction sent: ${hash}. Refresh after confirmation.`
            )
            setTimeout(() => {
                refetchBps()
            }, 2000)
        } catch (err: any) {
            console.error(err)
            const msg =
                err?.message?.toString() ??
                'Something went wrong while updating commission.'
            setErrorMessage(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
                <header className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Ambassador Maintenance
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Manage ambassador wallets and their global commission rate.
                        </p>
                    </div>
                    <WalletButton />
                </header>

                {!isConnected && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                        Connect the contract owner wallet to change ambassador settings.
                    </div>
                )}

                {isConnected && (
                    <>
                        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                                Current settings
                            </h2>

                            <div className="mt-3 text-sm text-slate-300">
                                {isBpsLoading ? (
                                    <p>Loading current commission…</p>
                                ) : bpsError ? (
                                    <p className="text-red-400">
                                        Failed to load commission from the contract.
                                    </p>
                                ) : (
                                    <p>
                                        Ambassador commission:{' '}
                                        <span className="font-mono">
                                            {currentCommissionPercent.toFixed(2)}%
                                        </span>{' '}
                                        per mint (global, for all ambassadors).
                                    </p>
                                )}

                                <p className="mt-2 text-xs text-slate-500">
                                    Only the contract owner can successfully send these
                                    transactions. If you are not the owner, calls will revert with
                                    an Ownable error.
                                </p>
                            </div>
                        </section>

                        <section className="grid gap-4 md:grid-cols-2">
                            {/* Ambassador add/remove */}
                            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                                    Ambassador list
                                </h2>

                                <label className="mt-3 block text-xs font-medium text-slate-400">
                                    Wallet address
                                </label>
                                <input
                                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-mono text-slate-100 placeholder:text-slate-500"
                                    placeholder="0x..."
                                    value={ambassadorAddress}
                                    onChange={(e) => setAmbassadorAddress(e.target.value.trim())}
                                />

                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSetAmbassador(true)}
                                        disabled={isSubmitting}
                                        className="flex-1 rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                                    >
                                        Add / enable ambassador
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetAmbassador(false)}
                                        disabled={isSubmitting}
                                        className="flex-1 rounded bg-rose-500 px-3 py-2 text-xs font-semibold text-rose-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                                    >
                                        Disable ambassador
                                    </button>
                                </div>
                            </div>

                            {/* Commission setting */}
                            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                                    Commission rate
                                </h2>

                                <form onSubmit={handleSetCommission} className="mt-3 space-y-2">
                                    <label className="block text-xs font-medium text-slate-400">
                                        Ambassador commission (% of mint price)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            className="w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                                            value={commissionPercentInput}
                                            onChange={(e) =>
                                                setCommissionPercentInput(e.target.value)
                                            }
                                        />
                                        <span className="text-xs text-slate-500">%</span>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="mt-3 inline-flex w-full items-center justify-center rounded bg-sky-500 px-3 py-2 text-xs font-semibold text-sky-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                                    >
                                        {isSubmitting
                                            ? 'Saving settings…'
                                            : 'Update commission rate'}
                                    </button>
                                </form>
                            </div>
                        </section>

                        {(statusMessage || errorMessage) && (
                            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs">
                                {statusMessage && (
                                    <p className="text-emerald-400">{statusMessage}</p>
                                )}
                                {errorMessage && (
                                    <p className="mt-1 text-red-400">{errorMessage}</p>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    )
}
