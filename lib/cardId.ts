// lib/cardId.ts
import { getAllCards } from './cardStore'

export async function generateNumericCardId(): Promise<string> {
    const cards = await getAllCards()
    const existing = new Set(cards.map((c) => c.cardId))

    while (true) {
        // 7–9 digit number: from 1_000_000 (7 digits) to 999_999_999 (9 digits)
        const n = Math.floor(1_000_000 + Math.random() * 999_000_000)
        const id = n.toString()
        if (!existing.has(id)) {
            return id
        }
    }
}
