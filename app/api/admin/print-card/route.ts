// app/api/admin/print-card/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { addCard } from '@/lib/cardStore'
import { generateNumericCardId } from '@/lib/cardId'

export const runtime = 'nodejs'

// same layout as mint-card
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

const QR_SIZE = 180
const QR_LEFT = CARD_WIDTH - QR_SIZE - 80
const QR_TOP = 1000

function buildTextSvg(params: {
    fullName: string
    alias?: string | null
    role: string
    cardId: string
    issueDate: string
    expirationDate: string
}) {
    const { fullName, alias, role, cardId, expirationDate } = params
    const displayAlias = alias && alias.trim().length > 0 ? alias.trim() : ''

    return `
<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .name {
      font-family: "Arial", sans-serif;
      font-size: 38px;
      font-weight: 700;
      fill: #111827;
    }
    .role {
      font-family: "Arial", sans-serif;
      font-size: 26px;
      fill: #1f2937;
    }
    .small {
      font-family: "Arial", sans-serif;
      font-size: 20px;
      fill: #4b5563;
    }
  </style>

  <text x="140" y="1030" class="name">${fullName}</text>
  ${displayAlias
            ? `<text x="140" y="1075" class="role">"${displayAlias}"</text>`
            : ''
        }
  <text x="140" y="${displayAlias ? 1120 : 1080}" class="role">${role}</text>

  <text x="140" y="${displayAlias ? 1170 : 1130}" class="small">ID: ${cardId}</text>
  <text x="140" y="${displayAlias ? 1210 : 1170}" class="small">EXPIRES: ${expirationDate}</text>
</svg>
`.trim()
}

async function createPdfFromPng(pngBuffer: Buffer): Promise<Buffer> {
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

async function writeLocalOutputs(
    cardId: string,
    png: Buffer,
    pdf: Buffer,
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

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()

        const firstName = formData.get('firstName') as string | null
        const lastName = formData.get('lastName') as string | null
        const alias = formData.get('alias') as string | null
        const role =
            (formData.get('role') as string | null) || 'Journalist'
        const email = formData.get('email') as string | null
        const phone = formData.get('phone') as string | null
        const deliveryAddress = formData.get('deliveryAddress') as string | null

        const photoFile = formData.get('photo') as File | null

        if (!firstName || !lastName || !photoFile) {
            return NextResponse.json(
                { ok: false, error: 'Missing required fields' },
                { status: 400 },
            )
        }

        const fullName = `${firstName} ${lastName}`.trim()
        const appBaseUrl =
            process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'

        const publicDir = path.join(process.cwd(), 'public')
        const bgPath = path.join(publicDir, 'kaprika-card-bg.png')
        const coaPath = path.join(publicDir, 'kaprika-coa.png')

        const [bgBuffer, coaBufferOrNull] = await Promise.all([
            fs.readFile(bgPath),
            fs.readFile(coaPath).catch(() => null),
        ])

        const photoArrayBuffer = await photoFile.arrayBuffer()
        const photoBuffer = Buffer.from(photoArrayBuffer)

        const resizedPhoto = await sharp(photoBuffer)
            .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: 'cover', position: 'centre' })
            .png()
            .toBuffer()

        const now = new Date()
        const issueDate = now.toISOString().slice(0, 10)
        const expiration = new Date(
            now.getFullYear() + 1,
            now.getMonth(),
            now.getDate(),
        )
        const expirationDate = expiration.toISOString().slice(0, 10)

        const cardId = await generateNumericCardId()

        const textSvg = buildTextSvg({
            fullName,
            alias,
            role,
            cardId,
            issueDate,
            expirationDate,
        })
        const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer()

        const verificationUrl = `${appBaseUrl}/verify/${cardId}`
        const qrPngBuffer = await QRCode.toBuffer(verificationUrl, {
            width: QR_SIZE,
            margin: 0,
        })

        const overlays: sharp.OverlayOptions[] = [
            { input: resizedPhoto, left: PHOTO_LEFT, top: PHOTO_TOP },
            { input: textPng, left: 0, top: 0 },
            { input: qrPngBuffer, left: QR_LEFT, top: QR_TOP },
        ]

        if (coaBufferOrNull) {
            const coaPng = await sharp(coaBufferOrNull)
                .resize(COA_WIDTH, COA_HEIGHT)
                .png()
                .toBuffer()
            overlays.push({ input: coaPng, left: COA_LEFT, top: COA_TOP })
        }

        const cardPngBuffer = await sharp(bgBuffer)
            .resize(CARD_WIDTH, CARD_HEIGHT)
            .composite(overlays)
            .png()
            .toBuffer()

        const pdfBuffer = await createPdfFromPng(cardPngBuffer)
        const { imageUrl, pdfUrl } = await writeLocalOutputs(
            cardId,
            cardPngBuffer,
            pdfBuffer,
            appBaseUrl,
        )

        const record = await addCard({
            cardId,
            wallet: '', // print version only
            fullName,
            role,
            alias: alias || null,
            email: email || null,
            phone: phone || null,
            deliveryAddress: deliveryAddress || null,
            imageUrl,
            pdfUrl,
            txHash: null,
            tokenId: null,
            issueDate,
            expirationDate,
            printed: false,
            shipped: false,
            delivered: false,
            revoked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })

        return NextResponse.json({
            ok: true,
            card: record,
            imageUrl,
            pdfUrl,
            verificationUrl,
        })
    } catch (err: any) {
        console.error('Error in /api/admin/print-card:', err)
        return NextResponse.json(
            { ok: false, error: 'Failed to create print-only card' },
            { status: 500 },
        )
    }
}
