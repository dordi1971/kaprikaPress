// app/api/card/[cardId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAllCards } from '@/lib/cardStore'

export const runtime = 'nodejs'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ cardId: string }> },
) {
    try {
        const { cardId } = await params

        const cards = await getAllCards()
        const card = cards.find((c) => c.cardId === cardId)

        if (!card) {
            return NextResponse.json(
                { ok: false, error: 'Card not found' },
                { status: 404 },
            )
        }

        return NextResponse.json({ ok: true, card })
    } catch (err) {
        console.error('GET /api/card/[cardId] error:', err)
        return NextResponse.json(
            { ok: false, error: 'Internal error' },
            { status: 500 },
        )
    }
}
