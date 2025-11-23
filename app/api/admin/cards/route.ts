// app/api/admin/cards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAllCards, updateCard } from '@/lib/cardStore'
import { kaprikaContract } from '@/lib/kaprikaContract'

export const runtime = 'nodejs'

export async function GET() {
    try {
        const cards = await getAllCards()
        return NextResponse.json({ ok: true, cards })
    } catch (err) {
        console.error('GET /api/admin/cards error:', err)
        return NextResponse.json(
            { ok: false, error: 'Failed to load cards' },
            { status: 500 },
        )
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            cardId,
            printed,
            shipped,
            delivered,
            revoked,
            tokenId,
        } = body as {
            cardId?: string
            printed?: boolean
            shipped?: boolean
            delivered?: boolean
            revoked?: boolean
            tokenId?: number | null
        }

        if (!cardId) {
            return NextResponse.json(
                { ok: false, error: 'cardId is required' },
                { status: 400 },
            )
        }

        const updates: any = {}
        if (typeof printed === 'boolean') updates.printed = printed
        if (typeof shipped === 'boolean') updates.shipped = shipped
        if (typeof delivered === 'boolean') updates.delivered = delivered
        if (typeof revoked === 'boolean') updates.revoked = revoked
        if (typeof tokenId === 'number' || tokenId === null) updates.tokenId = tokenId
        updates.updatedAt = new Date().toISOString()

        // On-chain revoke if requested and tokenId is known
        if (revoked === true && typeof tokenId === 'number') {
            try {
                await kaprikaContract.write.setRevoked([BigInt(tokenId), true])
            } catch (err) {
                console.error('setRevoked on-chain failed:', err)
                // We still update local status; you can change this behaviour if you want strict sync.
            }
        }

        const updated = await updateCard(cardId, updates)
        if (!updated) {
            return NextResponse.json(
                { ok: false, error: 'Card not found' },
                { status: 404 },
            )
        }

        return NextResponse.json({ ok: true, card: updated })
    } catch (err) {
        console.error('PATCH /api/admin/cards error:', err)
        return NextResponse.json(
            { ok: false, error: 'Failed to update card' },
            { status: 500 },
        )
    }
}
