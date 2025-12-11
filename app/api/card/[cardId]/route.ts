// app/api/card/[cardId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

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

async function loadCardDb(): Promise<CardRecord[]> {
    try {
        const raw = await fs.readFile(CARD_DB_FILE, 'utf8')
        return JSON.parse(raw) as CardRecord[]
    } catch (err: any) {
        if (err?.code === 'ENOENT') return []
        throw err
    }
}

export async function GET(req: NextRequest) {
    // Extract cardId from the URL path: /api/card/[cardId]
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    const cardId = segments[segments.length - 1]

    if (!cardId) {
        return NextResponse.json(
            { error: 'Missing cardId in URL' },
            { status: 400 },
        )
    }

    const cards = await loadCardDb()
    const card = cards.find((c) => c.cardId === cardId)

    if (!card) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(card)
}
