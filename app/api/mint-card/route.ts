// app/api/mint-card/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { Blob } from 'buffer'
import * as Client from '@storacha/client'
import { StoreMemory } from '@storacha/client/stores/memory'
import * as Proof from '@storacha/client/proof'
import { Signer } from '@storacha/client/principal/ed25519'
import { kaprikaContract } from '@/lib/kaprikaContract'

export const runtime = 'nodejs'

// ---------- CARD LAYOUT CONSTANTS ----------

const CARD_WIDTH = 1064
const CARD_HEIGHT = 1300

const PHOTO_WIDTH = 570
const PHOTO_HEIGHT = 570
const PHOTO_LEFT = 245
const PHOTO_TOP = 176

const COA_WIDTH = 150
const COA_HEIGHT = 150
const COA_LEFT = 70
const COA_TOP = 70

// QR code placement (bottom-right)
const QR_SIZE = 180
const QR_LEFT = CARD_WIDTH - QR_SIZE - 80
const QR_TOP = 1000

// ---------- TEXT SVG (ZONE 2) ----------

function buildTextSvg(params: {
  fullName: string
  alias?: string | null
  role: string
  cardId: string
  issueDate: string
  expirationDate: string
}) {
  const { fullName, alias, role, cardId, /* issueDate */ expirationDate } =
    params

  const displayAlias = alias && alias.trim().length > 0 ? alias.trim() : ''

  return `
<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .name {
      font-family: "Arial", sans-serif;
      font-size: 70px;
      font-weight: 700;
      fill: #111827;
    }
    .role {
      font-family: "Arial", sans-serif;
      font-size: 42px;
      fill: #1f2937;
    }
    .small {
      font-family: "Arial", sans-serif;
      font-size: 30px;
      fill: #4b5563;
    }
  </style>

  <text x="100" y="1050" class="name">${fullName}</text>
  ${displayAlias
      ? `<text x="100" y="1100" class="role">"${displayAlias}"</text>`
      : ''
    }
  <text x="100" y="${displayAlias ? 1140 : 1100}" class="role">${role}</text>

  <text x="100" y="${displayAlias ? 1190 : 1150}" class="small">ID: ${cardId}</text>
  <text x="100" y="${displayAlias ? 1230 : 1190}" class="small">EXPIRES: ${expirationDate}</text>
</svg>
`.trim()
}

// ---------- PDF FROM PNG ----------

async function createPdfFromPng(pngBuffer: Uint8Array): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const pngImage = await pdfDoc.embedPng(pngBuffer)

  const page = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// ---------- LOCAL FILE OUTPUT (for printing etc.) ----------

async function writeLocalOutputs(
  cardId: string,
  png: Uint8Array,
  pdf: Uint8Array,
  baseUrl: string,
) {
  const outDir = path.join(process.cwd(), 'public', 'generated')
  await fs.mkdir(outDir, { recursive: true })

  const imageName = `${cardId}.png`
  const pdfName = `${cardId}.pdf`

  await Promise.all([
    fs.writeFile(path.join(outDir, imageName), png),
    fs.writeFile(path.join(outDir, pdfName), pdf),
  ])

  const imageUrl = `${baseUrl}/generated/${imageName}`
  const pdfUrl = `${baseUrl}/generated/${pdfName}`

  return { imageUrl, pdfUrl }
}

// ---------- STORACHA CLIENT HELPERS ----------

let storachaClientPromise: Promise<Client.Client> | null = null

async function getStorachaClient() {
  if (!storachaClientPromise) {
    const key = process.env.STORACHA_KEY

    if (!key) {
      throw new Error('STORACHA_KEY must be set')
    }

    storachaClientPromise = (async () => {
      const principal = Signer.parse(key)
      const store = new StoreMemory()

      const client = await Client.create({ principal, store })

      // Read proof from file instead of env
      const proofPath = path.join(process.cwd(), 'storacha-proof.txt')
      const proofStr = (await fs.readFile(proofPath, 'utf8')).trim()

      const proof = await Proof.parse(proofStr)
      const space = await client.addSpace(proof)
      await client.setCurrentSpace(space.did())

      return client
    })()
  }

  return storachaClientPromise
}


type StorachaUploadResult = {
  cid: string
  gatewayUrl: string
}

async function uploadBufferToStoracha(
  data: Uint8Array,
  mimeType: string,
): Promise<StorachaUploadResult | null> {
  try {
    const client = await getStorachaClient()
    const blob = new Blob([data], { type: mimeType })
    const cid = await client.uploadFile(blob as any)
    const cidStr = cid.toString()

    const gatewayHost = process.env.STORACHA_GATEWAY_HOST || 'storacha.link'
    const gatewayUrl = `https://${cidStr}.ipfs.${gatewayHost}`

    return { cid: cidStr, gatewayUrl }
  } catch (err) {
    console.error('Storacha upload failed:', err)
    return null
  }
}



// ---------- MAIN HANDLER ----------

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const wallet = formData.get('wallet') as string | null
    const firstName = formData.get('firstName') as string | null
    const lastName = formData.get('lastName') as string | null
    const alias = formData.get('alias') as string | null
    const role = (formData.get('role') as string | null) || 'PRESS'
    const country = formData.get('country') as string | null
    const city = formData.get('city') as string | null

    const email = formData.get('email') as string | null
    const phone = formData.get('phone') as string | null
    const deliveryAddress = formData.get('deliveryAddress') as string | null

    const photoFile = formData.get('photo') as File | null

    if (!wallet || !firstName || !lastName || !photoFile) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const fullName = `${firstName} ${lastName}`.trim()
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'

    // Read template assets
    const publicDir = path.join(process.cwd(), 'public')
    const bgPath = path.join(publicDir, 'kaprika-card-bg.png')
    const coaPath = path.join(publicDir, 'kaprika-coa.png')

    const [bgBuffer, coaBufferOrNull] = await Promise.all([
      fs.readFile(bgPath),
      fs.readFile(coaPath).catch(() => null),
    ])

    // Photo
    const photoArrayBuffer = await photoFile.arrayBuffer()
    const photoBuffer = Buffer.from(photoArrayBuffer)

    const resizedPhoto = await sharp(photoBuffer)
      .resize(PHOTO_WIDTH, PHOTO_HEIGHT, {
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer()

    // Dates
    const now = new Date()
    const issueDate = now.toISOString().slice(0, 10)
    const expiration = new Date(
      now.getFullYear() + 1,
      now.getMonth(),
      now.getDate(),
    )
    const expirationDate = expiration.toISOString().slice(0, 10)

    // Card ID
    const cardId = `KAP-${Date.now().toString(36)}`

    // Text overlay (zone 2)
    const textSvg = buildTextSvg({
      fullName,
      alias,
      role,
      cardId,
      issueDate,
      expirationDate,
    })
    const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer()

    // QR → /verify/<cardId>
    const verificationUrl = `${appBaseUrl}/verify/${cardId}`
    const qrPngBuffer = await QRCode.toBuffer(verificationUrl, {
      width: QR_SIZE,
      margin: 0,
    })

    // Compose final card PNG
    const overlays: sharp.OverlayOptions[] = [
      { input: resizedPhoto, left: PHOTO_LEFT, top: PHOTO_TOP },
    ]

    if (coaBufferOrNull) {
      const coaPng = await sharp(coaBufferOrNull)
        .resize(COA_WIDTH, COA_HEIGHT)
        .png()
        .toBuffer()
      overlays.push({ input: coaPng, left: COA_LEFT, top: COA_TOP })
    }

    overlays.push(
      { input: textPng, left: 0, top: 0 },
      { input: qrPngBuffer, left: QR_LEFT, top: QR_TOP },
    )

    const cardPngBuffer = await sharp(bgBuffer)
      .resize(CARD_WIDTH, CARD_HEIGHT)
      .composite(overlays)
      .png()
      .toBuffer()

    // PDF
    const pdfBuffer = await createPdfFromPng(cardPngBuffer)

    // Local files for printing / manual access
    const { imageUrl, pdfUrl } = await writeLocalOutputs(
      cardId,
      cardPngBuffer,
      pdfBuffer,
      appBaseUrl,
    )

    // --------- TOKEN URI LOGIC ---------

    // Default: old behavior → tokenURI = HTTP link to PDF
    let tokenURI: string = pdfUrl

    let ipfsImage: StorachaUploadResult | null = null
    let ipfsPdf: StorachaUploadResult | null = null
    let ipfsMetadata: StorachaUploadResult | null = null

    // If Storacha is configured → upload PNG, PDF, then metadata.json
    if (process.env.STORACHA_KEY) {
      ipfsImage = await uploadBufferToStoracha(cardPngBuffer, 'image/png')
      ipfsPdf = await uploadBufferToStoracha(pdfBuffer, 'application/pdf')

      if (ipfsImage && ipfsPdf) {
        const metadata = {
          name: `Kaprika Press ID – ${fullName}`,
          description: 'Official Kaprika Press ID card.',
          image: `ipfs://${ipfsImage.cid}`,
          animation_url: `ipfs://${ipfsPdf.cid}`,
          external_url: verificationUrl,
          attributes: [
            { trait_type: 'Card ID', value: cardId },
            { trait_type: 'Role', value: role },
            { trait_type: 'Issued', value: issueDate },
            { trait_type: 'Expires', value: expirationDate },
            // you can add wallet, country/city, etc. here if you want
          ],
        }

        const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2))

        ipfsMetadata = await uploadBufferToStoracha(
          metadataBuffer,
          'application/json',
        )

        // If metadata upload worked → use IPFS metadata as tokenURI
        if (ipfsMetadata) {
          tokenURI = `ipfs://${ipfsMetadata.cid}`
        }
      }
    }

    // Mint NFT with final tokenURI
    let txHash: `0x${string}` | null = null
    try {
      txHash = await kaprikaContract.write.mintId([
        wallet as `0x${string}`,
        tokenURI,
      ])
    } catch (err) {
      console.error('Minting transaction failed:', err)
    }

    return NextResponse.json({
      ok: true,
      txHash,
      tokenURI,
      cardId,
      fullName,
      imageUrl,
      pdfUrl,
      verificationUrl,
      issueDate,
      expirationDate,
      email,
      phone,
      deliveryAddress,
      ipfsImageCid: ipfsImage?.cid ?? null,
      ipfsImageUrl: ipfsImage?.gatewayUrl ?? null,
      ipfsPdfCid: ipfsPdf?.cid ?? null,
      ipfsPdfUrl: ipfsPdf?.gatewayUrl ?? null,
      ipfsMetadataCid: ipfsMetadata?.cid ?? null,
      ipfsMetadataUrl: ipfsMetadata?.gatewayUrl ?? null,
    })
  } catch (err: any) {
    console.error('Error in /api/mint-card:', err)
    return NextResponse.json(
      { error: 'Failed to mint card', details: String(err?.message ?? err) },
      { status: 500 },
    )
  }
}
