// lib/cardStore.ts
import path from 'path'
import fs from 'fs/promises'

export interface CardRecord {
    cardId: string
    wallet: string
    fullName: string
    role: string
    alias?: string | null

    email?: string | null
    phone?: string | null
    deliveryAddress?: string | null

    imageUrl: string
    pdfUrl: string
    txHash: string | null
    tokenId?: number | null

    issueDate: string
    expirationDate: string

    printed: boolean
    shipped: boolean
    delivered: boolean
    revoked: boolean

    createdAt: string
    updatedAt: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'cards.json')

async function ensureDataFile() {
    await fs.mkdir(DATA_DIR, { recursive: true })
    try {
        await fs.access(DATA_FILE)
    } catch {
        await fs.writeFile(DATA_FILE, '[]', 'utf8')
    }
}

export async function getAllCards(): Promise<CardRecord[]> {
    await ensureDataFile()
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return parsed as CardRecord[]
        }
        return []
    } catch {
        return []
    }
}

async function saveAllCards(cards: CardRecord[]) {
    await ensureDataFile()
    await fs.writeFile(DATA_FILE, JSON.stringify(cards, null, 2), 'utf8')
}

export async function addCard(record: CardRecord): Promise<CardRecord> {
    const cards = await getAllCards()
    cards.push(record)
    await saveAllCards(cards)
    return record
}

export async function updateCard(
    cardId: string,
    updates: Partial<CardRecord>,
): Promise<CardRecord | null> {
    const cards = await getAllCards()
    const idx = cards.findIndex((c) => c.cardId === cardId)
    if (idx === -1) return null

    const updated: CardRecord = {
        ...cards[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
    }

    cards[idx] = updated
    await saveAllCards(cards)
    return updated
}
