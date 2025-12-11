'use client'

import { useState, type FormEvent } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { WalletButton } from '@/components/WalletButton'
import { PhotoUploader } from '@/components/PhotoUploader'
import { PhoneField, validatePhoneRequired } from '@/components/PhoneField'

// ---------- ON-CHAIN CONFIG ----------
const KAPRIKA_PRESS_ID_ADDRESS = process.env.NEXT_PUBLIC_KAPRIKA_PRESS_ID_ADDRESS as `0x${string}`

const USDC_ADDRESS = '0x5A22c444650805a1044EDEC3d59f3bA4163DAB33' as `0x${string}`
const KUSD_ADDRESS = '0xDD85030fA898306cCc3D473E588D7DC315742054' as `0x${string}`

// Minimal ERC20 ABI (approve only)
const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Minimal KaprikaPressID ABI for USDC mint
import { kaprikaPressIdAbi } from '@/lib/kaprikaAbi'

type CardPreviewProps = {
  firstName: string
  lastName: string
  alias: string
  role: string
  photoPreview: string | null
  nameAllCaps: boolean
}

function CardPreview({
  firstName,
  lastName,
  alias,
  role,
  photoPreview,
  nameAllCaps,
}: CardPreviewProps) {
  const rawFirst = (firstName || '').trim() || 'First'
  const rawLast = (lastName || '').trim() || 'Last'

  const displayFirst = nameAllCaps ? rawFirst.toUpperCase() : rawFirst
  const displayLast = nameAllCaps ? rawLast.toUpperCase() : rawLast

  const aliasDisplay = alias?.trim() || ''

  const previewCardId = 'KAP-XXXXXXX' // preview only

  const now = new Date()
  const expiration = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate(),
  )
  const expirationLabel = expiration.toISOString().slice(0, 10)

  // --- dynamic font size based on longest line ---
  const maxLineLength = Math.max(displayFirst.length, displayLast.length)

  let nameSizeClass: string
  if (maxLineLength <= 12) {
    nameSizeClass = 'text-xl'
  } else if (maxLineLength <= 18) {
    nameSizeClass = 'text-lg'
  } else if (maxLineLength <= 24) {
    nameSizeClass = 'text-base'
  } else {
    nameSizeClass = 'text-sm'
  }

  return (
    <div>
      <div className="relative w-full max-w-sm mx-auto aspect-[1064/1300] rounded-xl overflow-hidden shadow-lg border border-slate-700 bg-slate-900">
        {/* Background */}
        <div className="absolute inset-0 bg-[url('/kaprika-card-bg.png')] bg-cover bg-center opacity-90" />

        {/* Photo zone */}
        <div className="absolute left-[23%] top-[14%] w-[54%] aspect-square rounded-md overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center text-xs text-slate-400">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="Photo preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>Photo preview</span>
          )}
        </div>

        {/* Text zone: bottom-left */}
        <div className="absolute left-[8%] right-[8%] bottom-[4%]">
          <div className="space-y-1 rounded-md bg-slate-100/10 px-2 py-1 text-slate-900 shadow-sm backdrop-blur-[2px]">
            {/* First + last name on two lines, dynamic font size */}
            <div className={`${nameSizeClass} font-bold leading-tight`}>
              <div>{displayFirst}</div>
              <div>{displayLast}</div>
            </div>

            {aliasDisplay && (
              <div className="text-xs italic text-slate-700">
                &quot;{aliasDisplay}&quot;
              </div>
            )}

            <div className="text-xs font-medium mt-1">{role || 'Role'}</div>

            <div className="text-[10px] text-slate-700">
              EXPIRES: {expirationLabel}
            </div>
          </div>
        </div>

        {/* QR + ID cluster: bottom-right */}
        <div className="absolute right-[8%] bottom-[4%] flex flex-col items-center gap-1">
          <div className="w-[80%] aspect-square border-2 border-slate-700 rounded-md flex items-center justify-center text-[0.55rem] text-slate-500 bg-slate-900/60">
            QR
          </div>

          <div className="text-[0.55rem] font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-100">
            {previewCardId}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400 text-center">
        Preview only. The final card uses the same template and data, but minor
        layout differences are possible.
      </p>
    </div>
  )
}

const ADMIN_WALLETS =
  (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)

export default function HomePage() {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()

  // Is this wallet an admin?
  const isAdmin =
    isConnected && !!address && ADMIN_WALLETS.includes(address.toLowerCase())

  // Is this wallet an ambassador (on-chain)?
  const { data: isAmbassadorRaw } = useReadContract({
    address: KAPRIKA_PRESS_ID_ADDRESS,
    abi: kaprikaPressIdAbi,
    functionName: 'isAmbassador',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  })
  const isAmbassador = Boolean(isAmbassadorRaw)
  // Mint price from contract (USDC smallest units)
  const { data: mintPriceRaw } = useReadContract({
    address: KAPRIKA_PRESS_ID_ADDRESS,
    abi: kaprikaPressIdAbi,
    functionName: 'mintPriceUSDC',
  })

  // kUSD balance for the connected wallet
  const { data: kusdBalanceRaw } = useReadContract({
    address: KUSD_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const hasEnoughKUSD =
    isConnected &&
    address &&
    typeof mintPriceRaw === 'bigint' &&
    typeof kusdBalanceRaw === 'bigint' &&
    kusdBalanceRaw >= mintPriceRaw

  // ---------- Form state ----------
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [alias, setAlias] = useState('')
  const [role, setRole] = useState('Journalist')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('') // holds E.164: "+995555123456"
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [nameAllCaps, setNameAllCaps] = useState(true)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Ambassador-only: recipient wallet (optional)
  const [recipientWallet, setRecipientWallet] = useState('')

  // ---------- Mint flow state ----------
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [mintResult, setMintResult] = useState<{
    cardId?: string
    fullName?: string
    txHash?: string | null
    tokenURI?: string
    imageUrl?: string
    pdfUrl?: string
    verificationUrl?: string
    ipfsImageUrl?: string | null
    ipfsPdfUrl?: string | null
    ipfsMetadataUrl?: string | null
  } | null>(null)

  const hasCardCore =
    firstName.trim() !== '' && lastName.trim() !== '' && role.trim() !== ''

  const hasPhoto = !!photoPreview

  const hasDeliveryCore =
    email.trim() !== '' && phone.trim() !== '' && deliveryAddress.trim() !== ''

  const isFormComplete = hasCardCore && hasPhoto && hasDeliveryCore

  let statusLabel: string

  if (!isConnected) {
    statusLabel = 'Connect wallet to continue'
  } else if (isSubmitting) {
    statusLabel = 'Minting in progress'
  } else if (mintResult) {
    statusLabel = 'Minted'
  } else if (!hasCardCore) {
    statusLabel = 'Fill in your name and role'
  } else if (!hasPhoto) {
    statusLabel = 'Add your portrait photo'
  } else if (!hasDeliveryCore) {
    statusLabel = 'Fill in contact and address details'
  } else {
    statusLabel = 'Ready to mint'
  }

  // ---------- Submit handler ----------
  type PaymentMode = 'USDC' | 'KUSD'

  const handleMint = async (mode: PaymentMode) => {
    if (!isConnected || !address) {
      setErrorMessage('Wallet not connected.')
      return
    }

    const error = validatePhoneRequired(phone)
    if (error) {
      setPhoneError(error)
      return
    }

    if (!photoFile) {
      setErrorMessage('Please upload a portrait photo.')
      return
    }

    // Make sure mint price is configured on-chain
    const mintPrice = mintPriceRaw as bigint | undefined
    if (!mintPrice || mintPrice === 0n) {
      setErrorMessage('Mint price is not configured on the contract. Please contact admin.')
      return
    }

    if (mode === 'KUSD' && !hasEnoughKUSD) {
      setErrorMessage('You do not have enough kUSD to mint.')
      return
    }

    // Ambassador mint for another wallet?
    const trimmedRecipient = recipientWallet.trim()
    const isAmbassadorMintForOther = isAmbassador && trimmedRecipient !== ''

    let finalRecipient: string = address

    if (isAmbassadorMintForOther) {
      const re = /^0x[a-fA-F0-9]{40}$/
      if (!re.test(trimmedRecipient)) {
        setErrorMessage('Recipient wallet is not a valid address.')
        return
      }
      finalRecipient = trimmedRecipient
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setStatusMessage('Generating card and uploading assets…')
      setMintResult(null)

      // 1) Call backend to generate PNG/PDF, upload to Storacha, build tokenURI
      const formData = new FormData()
      formData.append('wallet', finalRecipient)
      formData.append('payerWallet', address)
      formData.append('firstName', firstName)
      formData.append('lastName', lastName)
      formData.append('nameAllCaps', nameAllCaps ? '1' : '0')
      formData.append('alias', alias)
      formData.append('role', role)
      formData.append('country', country)
      formData.append('city', city)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('deliveryAddress', deliveryAddress)
      formData.append('photo', photoFile)

      const res = await fetch('/api/mint-card', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `Card generation failed with status ${res.status}${text ? `: ${text.slice(0, 200)}` : ''
          }`,
        )
      }

      const data = await res.json()

      // 2) Approve correct payment token
      const tokenAddress = mode === 'USDC' ? USDC_ADDRESS : KUSD_ADDRESS

      setStatusMessage(
        mode === 'USDC'
          ? 'Opening MetaMask to approve USDC payment…'
          : 'Opening MetaMask to approve kUSD payment…',
      )

      const approveHash = await writeContractAsync({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: 'approve',
        args: [KAPRIKA_PRESS_ID_ADDRESS, mintPrice],
      })

      console.log('Approve tx hash:', approveHash)

      // 3) Ask MetaMask to mint Kaprika Press ID via chosen token
      setStatusMessage(
        mode === 'USDC'
          ? 'Opening MetaMask to mint your Kaprika Press ID NFT with USDC…'
          : 'Opening MetaMask to mint your Kaprika Press ID NFT with kUSD…',
      )

      const functionName =
        mode === 'USDC'
          ? isAmbassadorMintForOther
            ? 'mintIdWithUSDCFor'
            : 'mintIdWithUSDC'
          : isAmbassadorMintForOther
            ? 'mintIdWithKUSDFor'
            : 'mintIdWithKUSD'

      const mintTxHash = await writeContractAsync({
        abi: kaprikaPressIdAbi,
        address: KAPRIKA_PRESS_ID_ADDRESS,
        functionName,
        args: isAmbassadorMintForOther
          ? [finalRecipient as `0x${string}`, data.tokenURI]
          : [data.tokenURI],
      })

      console.log('Mint tx hash:', mintTxHash)

      // 4) Save result for UI
      setMintResult({
        cardId: data.cardId,
        fullName: data.fullName,
        txHash: mintTxHash,
        tokenURI: data.tokenURI,
        imageUrl: data.imageUrl,
        pdfUrl: data.pdfUrl,
        verificationUrl: data.verificationUrl,
        ipfsImageUrl: data.ipfsImageUrl ?? null,
        ipfsPdfUrl: data.ipfsPdfUrl ?? null,
        ipfsMetadataUrl: data.ipfsMetadataUrl ?? null,
      })

      setStatusMessage('Successfully minted your Kaprika Press ID!')
    } catch (err: any) {
      console.error(err)
      setErrorMessage(
        err?.shortMessage ||
        err?.message ||
        'Mint failed. Please try again or contact support.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }


  // ---------- JSX ----------
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:py-16">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Kingdom of Kaprika – Press ID Mint
            </h1>
            {!isConnected && (
              <p className="mt-2 text-sm text-slate-300">
                Connect your MetaMask wallet to mint your Kaprika Press ID NFT.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <a
                href="/admin"
                className="px-3 py-1 text-xs rounded-md border border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10"
              >
                Admin panel
              </a>
            )}

            {isAmbassador && (
              <a
                href="/ambassador"
                className="px-3 py-1 text-xs rounded-md border border-sky-400/70 text-sky-200 hover:bg-sky-500/10"
              >
                Personal Account
              </a>
            )}

            <WalletButton />
          </div>

        </header>

        {/* FORM (LEFT) + PREVIEW (RIGHT) */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* LEFT COLUMN: form + submit + messages + mint details */}
          <div className="flex-1 space-y-6">
            <form
              onSubmit={(e) => e.preventDefault()}
              className="space-y-6 border border-slate-700 rounded-xl p-6 bg-slate-900/60"
            >

              {/* On-card / on-chain info */}
              <fieldset
                className="space-y-4"
                disabled={!isConnected || isSubmitting}
              >
                <legend className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  1 · Card information (on-chain + on card)
                </legend>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">First name</label>
                    <input
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Last name</label>
                    <input
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      id="nameAllCaps"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                      checked={nameAllCaps}
                      onChange={(e) => setNameAllCaps(e.target.checked)}
                    />
                    <label
                      htmlFor="nameAllCaps"
                      className="text-xs text-slate-300"
                    >
                      Display name in ALL CAPS on the card
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Role</label>
                    <select
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option>Journalist</option>
                      <option>Photographer</option>
                      <option>Editor</option>
                      <option>Producer</option>
                      <option>Press</option>
                    </select>
                  </div>
                  <br />
                  <div>
                    <label className="block text-sm mb-1">
                      Country (optional)
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">
                      City (optional)
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>

                {isAmbassador && (
                  <div className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-emerald-200">
                      Ambassador mode
                    </p>
                    <p className="text-[11px] text-emerald-100">
                      You can mint this card for another wallet. If you leave
                      the field empty, the card will be minted to your own
                      wallet as usual (no ambassador commission). If you enter a
                      different wallet here, you will pay with your wallet and
                      the card will belong to that address.
                    </p>
                    <label className="block text-xs mb-1 text-emerald-100">
                      Recipient wallet (optional)
                    </label>
                    <input
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-emerald-500/60 text-xs font-mono text-emerald-50 placeholder:text-emerald-300/60"
                      placeholder="0x..."
                      value={recipientWallet}
                      onChange={(e) =>
                        setRecipientWallet(e.target.value.trim())
                      }
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm mb-1">
                    Portrait photo (for card)
                  </label>
                  <PhotoUploader
                    label="ID photo"
                    initialPreviewUrl={photoPreview ?? undefined}
                    onChange={(file, previewUrl) => {
                      setPhotoFile(file)
                      setPhotoPreview(previewUrl)
                    }}
                  />
                </div>
              </fieldset>

              {/* Off-chain delivery info */}
              <fieldset
                className="space-y-4 border-t border-slate-700 pt-4"
                disabled={!isConnected || isSubmitting}
              >
                <legend className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  2 · Delivery details (off-chain only)
                </legend>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">
                      Delivery address (for physical card)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                      rows={3}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Include country, city, ZIP / postcode and any delivery
                      instructions.
                    </p>
                  </div>

                  <div>
                    <PhoneField
                      label="Phone"
                      value={phone}
                      onChange={(val) => {
                        setPhone(val)
                        if (phoneError) setPhoneError(null)
                      }}
                      required
                      name="phone"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">
                    Delivery address (for physical card)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                    rows={3}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    required
                  />
                </div>

                <p className="text-xs text-slate-400">
                  These details are stored off-chain and used only to produce
                  and deliver your physical Kaprika Press ID card.
                </p>
              </fieldset>

              {/* Submit + status inside the form */}
              <div className="pt-4 border-t border-slate-700 mt-2 flex flex-col gap-3">
                <div className="flex flex-col gap-3">
                  {/* Primary: always available – mint with USDC */}
                  <button
                    type="button"
                    disabled={isSubmitting || !isConnected}
                    onClick={() => handleMint('USDC')}
                    className={`px-4 py-2 rounded-md font-medium ${isSubmitting || !isConnected
                      ? 'bg-slate-500 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600'
                      } text-white transition-colors`}
                  >
                    {isSubmitting ? 'Minting, please wait…' : 'Mint with USDC'}
                  </button>

                  {/* Secondary: visible only if wallet holds enough kUSD */}
                  {hasEnoughKUSD && (
                    <button
                      type="button"
                      disabled={isSubmitting || !isConnected}
                      onClick={() => handleMint('KUSD')}
                      className={`px-4 py-2 rounded-md font-medium ${isSubmitting || !isConnected
                        ? 'bg-slate-500 cursor-not-allowed'
                        : 'bg-indigo-500 hover:bg-indigo-600'
                        } text-white transition-colors`}
                    >
                      {isSubmitting ? 'Minting, please wait…' : 'Mint with kUSD'}
                    </button>
                  )}
                </div>


                {statusMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    <span className="mt-0.5 text-lg">✔</span>
                    <p>{statusMessage}</p>
                  </div>
                )}

                {errorMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 whitespace-pre-wrap">
                    <span className="mt-0.5 text-lg">⚠</span>
                    <p>{errorMessage}</p>
                  </div>
                )}
              </div>
            </form>

            {/* Mint result (under the form, same column) */}
            {mintResult && (
              <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/60">
                <h2 className="text-lg font-semibold mb-3">Mint details</h2>

                {mintResult.fullName && (
                  <p className="text-sm text-slate-200 mb-1">
                    Name:{' '}
                    <span className="font-medium">{mintResult.fullName}</span>
                  </p>
                )}

                {mintResult.cardId && (
                  <p className="text-sm text-slate-200 mb-1">
                    Card ID:{' '}
                    <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                      {mintResult.cardId}
                    </span>
                  </p>
                )}

                {mintResult.txHash && (
                  <p className="text-sm text-slate-200 mb-1">
                    Transaction hash:{' '}
                    <span className="font-mono break-all">
                      {mintResult.txHash}
                    </span>
                    <span className="ml-2">
                      (
                      <a
                        href={`https://amoy.polygonscan.com/tx/${mintResult.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 underline"
                      >
                        Check on Polygonscan
                      </a>
                      )
                    </span>
                  </p>
                )}

                {mintResult.tokenURI && (
                  <p className="text-sm text-slate-200 mb-1">
                    tokenURI:{' '}
                    <span className="font-mono break-all">
                      {mintResult.tokenURI}
                    </span>
                  </p>
                )}

                {mintResult.verificationUrl && (
                  <p className="text-sm text-slate-200 mb-1">
                    Verification page:{' '}
                    <a
                      href={mintResult.verificationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline"
                    >
                      Open /verify page
                    </a>
                  </p>
                )}

                {!mintResult.ipfsMetadataUrl &&
                  (mintResult.imageUrl || mintResult.pdfUrl) && (
                    <div className="mt-3 space-x-3">
                      {mintResult.imageUrl && (
                        <a
                          href={mintResult.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-slate-100 underline"
                        >
                          View card PNG
                        </a>
                      )}
                      {mintResult.pdfUrl && (
                        <a
                          href={mintResult.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-slate-100 underline"
                        >
                          Download PDF
                        </a>
                      )}
                    </div>
                  )}

                {(mintResult.ipfsImageUrl ||
                  mintResult.ipfsPdfUrl ||
                  mintResult.ipfsMetadataUrl) && (
                    <div className="mt-4 border-t border-slate-700 pt-3">
                      <p className="text-sm text-slate-300 mb-2">
                        IPFS (via Storacha):
                      </p>
                      {mintResult.ipfsImageUrl && (
                        <p className="text-xs text-slate-300 mb-1">
                          Image:{' '}
                          <a
                            href={mintResult.ipfsImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 underline break-all"
                          >
                            {mintResult.ipfsImageUrl}
                          </a>
                        </p>
                      )}
                      {mintResult.ipfsPdfUrl && (
                        <p className="text-xs text-slate-300 mb-1">
                          PDF:{' '}
                          <a
                            href={mintResult.ipfsPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 underline break-all"
                          >
                            {mintResult.ipfsPdfUrl}
                          </a>
                        </p>
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: live preview */}
          <div className="w-full lg:w-[380px] xl:w-[420px] lg:sticky lg:top-10">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
              <h2 className="mb-3 text-sm font-medium text-slate-300">
                Live card preview
              </h2>
              <CardPreview
                firstName={firstName}
                lastName={lastName}
                alias={alias}
                role={role}
                photoPreview={photoPreview}
                nameAllCaps={nameAllCaps}
              />

              {/* Status badges */}
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                {/* Wallet badge */}
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 bg-slate-900/80 text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isConnected && address
                    ? `Wallet: ${address.slice(0, 6)}…${address.slice(-4)}`
                    : 'Wallet: Not connected'}
                </span>

                {/* Status badge */}
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 bg-slate-900/80 text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  {`Status: ${statusLabel}`}
                </span>

                {/* Ambassador badge */}
                {isAmbassador && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 px-2 py-0.5 bg-emerald-500/10 text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Ambassador
                  </span>
                )}

                {/* Card badge */}
                {mintResult?.cardId && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 bg-slate-900/80 text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Card: {mintResult.cardId}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
