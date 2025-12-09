'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import {
    kaprikaPressIdAbi,
    KAPRIKA_PRESS_ID_ADDRESS,
} from '@/lib/kaprikaAbi'
import { WalletButton } from '@/components/WalletButton'

const USDC_DECIMALS = 6

export default function AmbassadorOfficePage() {
    const { address, isConnected: isConnectedRaw } = useAccount()
    const [mounted, setMounted] = useState(false)

    // Prevent hydration errors
    useEffect(() => {
        setMounted(true)
    }, [])

    const isConnected = mounted && isConnectedRaw

    const { writeContractAsync } = useWriteContract()

    const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isWithdrawing, setIsWithdrawing] = useState(false)

    // --- On-chain reads ---

    const {
        data: isAmbassadorRaw,
        isLoading: isAmbassadorLoading,
        error: isAmbassadorError,
    } = useReadContract({
        address: KAPRIKA_PRESS_ID_ADDRESS,
        abi: kaprikaPressIdAbi,
        functionName: 'isAmbassador',
        args: address ? [address as `0x${string}`] : undefined,
        query: { enabled: !!address },
    })

    const {
        data: ambassadorBalanceRaw,
        isLoading: isBalanceLoading,
        error: balanceError,
        refetch: refetchBalance,
    } = useReadContract({
        address: KAPRIKA_PRESS_ID_ADDRESS,
        abi: kaprikaPressIdAbi,
        functionName: 'ambassadorPoolUSDC',
        args: address ? [address as `0x${string}`] : undefined,
        query: { enabled: !!address },
    })

    const {
        data: commissionBpsRaw,
        isLoading: isBpsLoading,
        error: bpsError,
    } = useReadContract({
        address: KAPRIKA_PRESS_ID_ADDRESS,
        abi: kaprikaPressIdAbi,
        functionName: 'ambassadorCommissionBps',
    })

    const isAmbassador = Boolean(isAmbassadorRaw)
    const balanceUSDC = useMemo(() => {
        const value = ambassadorBalanceRaw as bigint | undefined
        if (!value) return 0
        // Safe enough for UI: convert bigint -> number for display
        return Number(value) / 10 ** USDC_DECIMALS
    }, [ambassadorBalanceRaw])

    const commissionPercent = useMemo(() => {
        const bps = (commissionBpsRaw as bigint | undefined) ?? 0n
        return Number(bps) / 100 // 2500 -> 25.00
    }, [commissionBpsRaw])

    // --- Actions ---

    const handleWithdraw = async () => {
        if (!address) {
            setErrorMessage('Please connect your wallet first.')
            return
        }

        if (!isAmbassador) {
            setErrorMessage('This wallet is not registered as an ambassador.')
            return
        }

        if ((ambassadorBalanceRaw as bigint | undefined) === undefined) {
            setErrorMessage('Ambassador balance is not loaded yet.')
            return
        }

        const rawBalance = ambassadorBalanceRaw as bigint
        if (rawBalance === 0n) {
            setErrorMessage('Your commission balance is zero.')
            return
        }

        setIsWithdrawing(true)
        setErrorMessage(null)
        setTxHash(null)

        try {
            // withdrawAmbassadorUSDC(0) => withdraw full balance
            const hash = await writeContractAsync({
                address: KAPRIKA_PRESS_ID_ADDRESS,
                abi: kaprikaPressIdAbi,
                functionName: 'withdrawAmbassadorUSDC',
                args: [0n],
            })

            setTxHash(hash)
            // Small delay so the subgraph / RPC can catch up, then refetch
            setTimeout(() => {
                refetchBalance()
            }, 2000)
        } catch (err: any) {
            console.error(err)
            const msg =
                err?.message?.toString() ??
                'Something went wrong while withdrawing your commission.'
            setErrorMessage(msg)
        } finally {
            setIsWithdrawing(false)
        }
    }

    // --- UI ---

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
                <header className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Ambassador Office
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Check your commission balance and withdraw earned USDC.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href="/"
                            className="px-3 py-1 text-xs rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800/80"
                        >
                            Back to mint
                        </a>
                        <WalletButton />
                    </div>
                </header>
                {!isConnected && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                        Connect your wallet to see your ambassador status and balance.
                    </div>
                )}

                {isConnected && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Status card */}
                        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                                Status
                            </h2>
                            <div className="mt-3 text-sm">
                                {isAmbassadorLoading ? (
                                    <p className="text-slate-400">Checking ambassador status…</p>
                                ) : isAmbassadorError ? (
                                    <p className="text-red-400">
                                        Failed to check ambassador status.
                                    </p>
                                ) : isAmbassador ? (
                                    <p className="font-medium text-emerald-400">
                                        This wallet is registered as an ambassador.
                                    </p>
                                ) : (
                                    <p className="font-medium text-amber-400">
                                        This wallet is <span className="underline">not</span>{' '}
                                        registered as an ambassador.
                                    </p>
                                )}

                                <div className="mt-4 text-xs text-slate-400">
                                    <div>Your address:</div>
                                    <div className="break-all font-mono text-[11px] text-slate-300">
                                        {address}
                                    </div>
                                    {!isAmbassador && (
                                        <p className="mt-2">
                                            If you believe this is a mistake, contact the Kaprika
                                            team so they can add your wallet as an ambassador.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Balance & withdraw card */}
                        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                                Commission balance
                            </h2>

                            {isBalanceLoading ? (
                                <p className="mt-3 text-sm text-slate-400">
                                    Loading your balance…
                                </p>
                            ) : balanceError ? (
                                <p className="mt-3 text-sm text-red-400">
                                    Failed to load balance.
                                </p>
                            ) : (
                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-slate-400">Available USDC:</span>
                                        <span className="font-mono text-lg">
                                            {balanceUSDC.toFixed(4)}{' '}
                                            <span className="text-xs text-slate-400">USDC</span>
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-xs text-slate-400">
                                        <span>Global ambassador commission:</span>
                                        {isBpsLoading ? (
                                            <span>…</span>
                                        ) : bpsError ? (
                                            <span className="text-red-400">error</span>
                                        ) : (
                                            <span>{commissionPercent.toFixed(2)} % per mint</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleWithdraw}
                                disabled={
                                    isWithdrawing ||
                                    !isAmbassador ||
                                    !ambassadorBalanceRaw ||
                                    (ambassadorBalanceRaw as bigint) === 0n
                                }
                                className="mt-4 inline-flex w-full items-center justify-center rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                            >
                                {isWithdrawing ? 'Withdrawing…' : 'Withdraw all commission'}
                            </button>

                            {txHash && (
                                <p className="mt-3 text-xs text-slate-400">
                                    Withdrawal transaction:{' '}
                                    <span className="break-all font-mono text-[11px]">
                                        {txHash}
                                    </span>
                                </p>
                            )}

                            {errorMessage && (
                                <p className="mt-3 text-xs text-red-400">{errorMessage}</p>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </main>
    )
}
