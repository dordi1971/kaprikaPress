// app/api/mint-card/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { Blob } from 'buffer'
import * as Client from '@storacha/client'
import { StoreMemory } from '@storacha/client/stores/memory'
import * as Proof from '@storacha/client/proof'
import { Signer } from '@storacha/client/principal/ed25519'

import { computeDisplayName } from '@/lib/nameLayout'
import { generateNumericCardId } from '@/lib/cardId'

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
const nameX = 100
const firstLineBaselineY = 1030
// QR code placement (bottom-right)
const QR_SIZE = 220
const QR_LEFT = CARD_WIDTH - QR_SIZE - 60
const QR_TOP = 980

// ---------- SIMPLE CARD "DATABASE" (JSON FILE) ----------

type CardRecord = {
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
  deliveryAddress?: string | null
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

const DATA_DIR = path.join(process.cwd(), 'data')
const CARD_DB_FILE = path.join(DATA_DIR, 'cards.json')

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function loadCardDb(): Promise<CardRecord[]> {
  await ensureDataDir()
  try {
    const raw = await fs.readFile(CARD_DB_FILE, 'utf8')
    return JSON.parse(raw) as CardRecord[]
  } catch (err: any) {
    if (err?.code === 'ENOENT') return []
    throw err
  }
}

async function saveCardDb(cards: CardRecord[]) {
  await ensureDataDir()
  await fs.writeFile(CARD_DB_FILE, JSON.stringify(cards, null, 2), 'utf8')
}

async function upsertCard(record: CardRecord) {
  const cards = await loadCardDb()
  const idx = cards.findIndex((c) => c.cardId === record.cardId)
  if (idx >= 0) {
    cards[idx] = record
  } else {
    cards.push(record)
  }
  await saveCardDb(cards)
}


// ---------- TEXT SVG (ZONE 2) ----------

function buildTextSvg(params: {
  displayFirst: string
  displayLast: string
  nameAllCaps: boolean
  alias?: string | null
  role: string
  cardId: string
  issueDate: string
  expirationDate: string
  fontSize: number
}) {
  const lineGap = params.fontSize * 1.05
  const { displayFirst, displayLast, alias, role, cardId, /* issueDate */ expirationDate } =
    params

  const displayAlias = alias && alias.trim().length > 0 ? alias.trim() : ''

  return `
<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .name {
      font-family: "Arial", sans-serif;
      font-size: ${params.fontSize}px;
      text-transform: uppercase; 
      font-weight: 700;
      fill: #111827;
    }
    .role {
      font-family: "Arial", sans-serif;
      font-size: ${params.fontSize * 0.6}px;
      fill: #1f2937;
    }
    .small {
      font-family: "Arial", sans-serif;
      font-size: ${params.fontSize * 0.4}px;
      fill: #4b5563;
    }
  </style>
  <text x="${nameX}" y="${firstLineBaselineY}" class="name">${displayFirst}</text>
  <text x="${nameX}" y="${firstLineBaselineY + lineGap}" class="name">${displayLast}</text>

  <text x="${nameX}" y="${firstLineBaselineY + lineGap * 1.7}" class="role">${role}</text>

  <text x="${QR_LEFT}" y="${QR_TOP + QR_SIZE + 40}" class="small">ID: ${cardId}</text>
  <text x="${nameX}" y="${QR_TOP + QR_SIZE + 40}" class="small">EXPIRES: ${expirationDate}</text>
</svg>
`.trim()
}

// Helper to flip coordinates from top-left (SVG/Canvas) to bottom-left (PDF)
function toPdfY(yFromTop: number, height: number = 0) {
  return CARD_HEIGHT - (yFromTop + height)
}

async function createVectorPdf(params: {
  displayFirst: string
  displayLast: string
  nameAllCaps: boolean
  role: string
  cardId: string
  expirationDate: string
  fontSize: number
  photoBuffer: Buffer
  qrBuffer: Buffer
  coaBuffer: Buffer | null
}): Promise<Buffer> {
  const lineGap = params.fontSize * 1.05
  const {
    displayFirst,
    displayLast,
    role,
    cardId,
    expirationDate,
    fontSize,
    photoBuffer,
    qrBuffer,
    coaBuffer,
  } = params

  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // -- PAGE 1: FRONT --
  const page = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])

  // 1. Background
  const frontBgBytes = await fs.readFile(
    path.join(process.cwd(), 'public', 'kaprika-card-bg.png'),
  )
  const frontBgImage = await pdfDoc.embedPng(frontBgBytes)
  page.drawImage(frontBgImage, {
    x: 0,
    y: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  })

  // 2. User Photo
  // Embed PNG (since sharp converted it to PNG)
  const photoImage = await pdfDoc.embedPng(photoBuffer)
  // PDF y is bottom-left of image
  page.drawImage(photoImage, {
    x: PHOTO_LEFT,
    y: toPdfY(PHOTO_TOP, PHOTO_HEIGHT),
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
  })

  // 3. COA (if exists)
  if (coaBuffer) {
    const coaImage = await pdfDoc.embedPng(coaBuffer)
    page.drawImage(coaImage, {
      x: COA_LEFT,
      y: toPdfY(COA_TOP, COA_HEIGHT),
      width: COA_WIDTH,
      height: COA_HEIGHT,
    })
  }

  // 4. QR Code
  const qrImage = await pdfDoc.embedPng(qrBuffer)
  page.drawImage(qrImage, {
    x: QR_LEFT,
    y: toPdfY(QR_TOP, QR_SIZE),
    width: QR_SIZE,
    height: QR_SIZE,
  })

  // 5. Text (Vectorized)
  // Text Y in drawing commands is the baseline.
  // In our SVG logic, y values where baselines from top.
  // So converting them: y_pdf = HEIGHT - y_svg_baseline.

  // Name Line 1
  page.drawText(displayFirst, {
    x: nameX,
    y: toPdfY(firstLineBaselineY),
    size: fontSize,
    font: fontBold,
    color: rgb(0.067, 0.094, 0.153), // #111827
  })

  // Name Line 2
  page.drawText(displayLast, {
    x: nameX,
    y: toPdfY(firstLineBaselineY + lineGap),
    size: fontSize,
    font: fontBold,
    color: rgb(0.067, 0.094, 0.153), // #111827
  })

  // Role
  page.drawText(role, {
    x: nameX,
    y: toPdfY(firstLineBaselineY + lineGap * 1.7),
    size: fontSize * 0.6,
    font: fontRegular,
    color: rgb(0.122, 0.161, 0.216), // #1f2937
  })

  // Small Text (ID, Expiry)
  // SVG Logic:
  // ID: y = QR_TOP + QR_SIZE + 40
  // Expiry: y = QR_TOP + QR_SIZE + 40 (wait, both same Y in original SVG function? Let's check...)
  // Original SVG function:
  // <text x="${QR_LEFT}" y="${QR_TOP + QR_SIZE + 40}" class="small">ID: ${cardId}</text>
  // <text x="${nameX}" y="${QR_TOP + QR_SIZE + 40}" class="small">EXPIRES: ${expirationDate}</text>
  // Yes, they are on the same line.

  const footerY = QR_TOP + QR_SIZE + 40
  const smallSize = fontSize * 0.4
  const smallColor = rgb(0.294, 0.333, 0.388) // #4b5563

  page.drawText(`ID: ${cardId}`, {
    x: QR_LEFT,
    y: toPdfY(footerY),
    size: smallSize,
    font: fontRegular,
    color: smallColor,
  })

  page.drawText(`EXPIRES: ${expirationDate}`, {
    x: nameX,
    y: toPdfY(footerY),
    size: smallSize,
    font: fontRegular,
    color: smallColor,
  })


  // -- PAGE 2: BACK --
  const backBgBytes = await fs.readFile(
    path.join(process.cwd(), 'public', 'kaprika-card-back.png'),
  )
  const backBgImage = await pdfDoc.embedPng(backBgBytes)
  const backPage = pdfDoc.addPage([CARD_WIDTH, CARD_HEIGHT])
  backPage.drawImage(backBgImage, {
    x: 0,
    y: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

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

  // Serve files through an API route instead of static /generated/*
  const imageUrl = `${baseUrl}/api/card-file/${cardId}/image`
  const pdfUrl = `${baseUrl}/api/card-file/${cardId}/pdf`

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
    const nameAllCaps = formData.get('nameAllCaps') === '1'
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
    const cardId = await generateNumericCardId()

    // Text overlay (zone 2)
    const { displayFirst, displayLast, fontSize } = computeDisplayName(
      firstName,
      lastName,
      nameAllCaps,
    )




    const textSvg = buildTextSvg({
      displayFirst,
      displayLast,
      nameAllCaps,
      alias,
      role,
      cardId,
      issueDate,
      expirationDate,
      fontSize,
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
    const pdfBuffer = await createVectorPdf({
      displayFirst,
      displayLast,
      nameAllCaps,
      role,
      cardId,
      expirationDate,
      fontSize,
      photoBuffer: resizedPhoto,
      qrBuffer: qrPngBuffer,
      coaBuffer: coaBufferOrNull,
    })

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

    // NOTE: We no longer mint on the server.
    // The server only prepares assets + tokenURI and returns them.
    const txHash: `0x${string}` | null = null
    const tokenContract =
      process.env.NEXT_PUBLIC_KAPRIKA_PRESS_ID_ADDRESS || null

    const nowIso = new Date().toISOString()

    const cardRecord: CardRecord = {
      cardId,
      wallet, // from formData (already validated as non-null)
      firstName,
      lastName,
      alias: alias ?? null,
      role,
      country: country ?? null,
      city: city ?? null,
      email: email ?? null,
      phone: phone ?? null,
      deliveryAddress: deliveryAddress ?? null,
      imageUrl,
      pdfUrl,
      verificationUrl,
      tokenURI,
      issueDate,
      expirationDate,
      txHash,
      tokenContract,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    await upsertCard(cardRecord)

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
