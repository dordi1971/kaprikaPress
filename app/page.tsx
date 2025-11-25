'use client'

import { useState, type FormEvent } from 'react'
import { useAccount } from 'wagmi'
import { WalletButton } from '@/components/WalletButton'
import { PhotoUploader } from '@/components/PhotoUploader'

type CardPreviewProps = {
  firstName: string
  lastName: string
  alias: string
  role: string
  photoPreview: string | null
}

function CardPreview({
  firstName,
  lastName,
  alias,
  role,
  photoPreview,
}: CardPreviewProps) {
  const fullName =
    (firstName || lastName)
      ? `${firstName || ''} ${lastName || ''}`.trim()
      : 'FIRST LAST'

  const aliasDisplay = alias?.trim()
  const previewCardId = 'KAP-XXXXXXX'

  const now = new Date()
  const expiration = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate(),
  )
  const expirationLabel = expiration.toISOString().slice(0, 10)

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-slate-200 mb-2">
        Card preview
      </h2>

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

        {/* Text zone */}
        <div className="absolute left-[10%] right-[10%] bottom-[6%] space-y-1 text-slate-900">
          <div className="text-lg font-bold leading-tight">
            {fullName}
          </div>

          {aliasDisplay && (
            <div className="text-sm italic text-slate-700">
              &quot;{aliasDisplay}&quot;
            </div>
          )}

          <div className="text-sm font-medium mt-1">
            {role || 'Role'}
          </div>

          <div className="text-xs text-slate-700 mt-1">
            ID: {previewCardId}
          </div>
          <div className="text-xs text-slate-700">
            EXPIRES: {expirationLabel}
          </div>
        </div>

        {/* QR placeholder */}
        <div className="absolute right-[8%] bottom-[10%] w-[18%] aspect-square border-2 border-slate-700 rounded-md flex items-center justify-center text-[0.55rem] text-slate-500 bg-slate-900/60">
          QR
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400 text-center">
        Preview only. The final card uses the same template and data, but minor layout
        differences are possible.
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

  const isAdmin =
    isConnected &&
    !!address &&
    ADMIN_WALLETS.includes(address.toLowerCase())

  // ---------- Form state ----------
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [alias, setAlias] = useState('')
  const [role, setRole] = useState('Journalist')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

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

  // ---------- Submit handler ----------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!isConnected || !address) {
      setErrorMessage('Wallet not connected.')
      return
    }

    if (!photoFile) {
      setErrorMessage('Please upload a portrait photo.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setStatusMessage('Generating card, uploading to IPFS and minting NFT…')
      setMintResult(null)

      const formData = new FormData()
      formData.append('wallet', address)
      formData.append('firstName', firstName)
      formData.append('lastName', lastName)
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
          `Mint failed with status ${res.status}${text ? `: ${text.slice(0, 200)}` : ''
          }`,
        )
      }

      const data = await res.json()

      setMintResult({
        cardId: data.cardId,
        fullName: data.fullName,
        txHash: data.txHash,
        tokenURI: data.tokenURI,
        imageUrl: data.imageUrl,
        pdfUrl: data.pdfUrl,
        verificationUrl: data.verificationUrl,
        ipfsImageUrl: data.ipfsImageUrl ?? null,
        ipfsPdfUrl: data.ipfsPdfUrl ?? null,
        ipfsMetadataUrl: data.ipfsMetadataUrl ?? null,
      })

      setStatusMessage('Your Kaprika Press ID has been minted successfully.')
    } catch (err: any) {
      console.error(err)
      setErrorMessage(
        err?.message ||
        'Something went wrong while minting your Kaprika Press ID.',
      )
      setStatusMessage(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------- JSX ----------
  return (
    <main className="min-h-screen flex flex-col items-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-3xl px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold">
            Kingdom of Kaprika – Press ID Mint
          </h1>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <a
                href="/admin"
                className="px-3 py-1 text-xs rounded-md border border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10"
              >
                Admin panel
              </a>
            )}
            <WalletButton />
          </div>
        </header>

        {!isConnected && (
          <p className="mb-6 text-sm text-slate-300">
            Connect your MetaMask wallet to mint your Kaprika Press ID NFT.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 border border-slate-700 rounded-xl p-6 bg-slate-900/60"
        >
          {/* On-card / on-chain info */}
          <fieldset
            className="space-y-4"
            disabled={!isConnected || isSubmitting}
          >
            <legend className="font-semibold mb-2">
              Card information (on-chain + on card)
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
              <div>
                <label className="block text-sm mb-1">Country (optional)</label>
                <input
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">City (optional)</label>
                <input
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

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
            <legend className="font-semibold mb-2">
              Delivery details (off-chain only)
            </legend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
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
              These details are stored off-chain and used only to produce and
              deliver your physical Kaprika Press ID card.
            </p>
          </fieldset>
          <CardPreview
            firstName={firstName}
            lastName={lastName}
            alias={alias}
            role={role}
            photoPreview={photoPreview}
          />

          {/* Submit + status */}
          <button
            type="submit"
            disabled={isSubmitting || !isConnected}
            className={`px-4 py-2 rounded-md font-medium ${isSubmitting || !isConnected
              ? 'bg-slate-500 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600'
              } text-white transition-colors`}
          >
            {isSubmitting ? 'Minting, please wait…' : 'Mint Kaprika Press ID'}
          </button>

          {statusMessage && (
            <p className="mt-4 text-sm text-emerald-400">
              {statusMessage}
            </p>
          )}

          {errorMessage && (
            <p className="mt-4 text-sm text-red-400 whitespace-pre-wrap">
              {errorMessage}
            </p>
          )}

          {mintResult && (
            <div className="mt-6 border border-slate-700 rounded-xl p-4 bg-slate-900/60">
              <h2 className="text-lg font-semibold mb-3">Mint details</h2>

              {mintResult.fullName && (
                <p className="text-sm text-slate-200 mb-1">
                  Name:{' '}
                  <span className="font-medium">
                    {mintResult.fullName}
                  </span>
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

              {(mintResult.imageUrl || mintResult.pdfUrl) && (
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
                    {mintResult.ipfsMetadataUrl && (
                      <p className="text-xs text-slate-300 mb-1">
                        Metadata:{' '}
                        <a
                          href={mintResult.ipfsMetadataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 underline break-all"
                        >
                          {mintResult.ipfsMetadataUrl}
                        </a>
                      </p>
                    )}
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
        </form>
      </div>
    </main>
  )
}
