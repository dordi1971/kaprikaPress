// app/api/card-file/[cardId]/[kind]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ cardId: string; kind: string }> },
) {
    const { cardId, kind } = await context.params

    const ext =
        kind === 'image'
            ? 'png'
            : kind === 'pdf'
                ? 'pdf'
                : null

    if (!ext) {
        return NextResponse.json(
            { ok: false, error: 'Invalid file type' },
            { status: 400 },
        )
    }

    const filePath = path.join(
        process.cwd(),
        'public',
        'generated',
        `${cardId}.${ext}`,
    )

    try {
        const file = await fs.readFile(filePath)
        const contentType =
            ext === 'png' ? 'image/png' : 'application/pdf'

        return new NextResponse(file, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition':
                    ext === 'pdf'
                        ? `inline; filename="${cardId}.pdf"`
                        : `inline; filename="${cardId}.png"`,
            },
        })
    } catch (err) {
        console.error('Error reading card file:', err)
        return NextResponse.json(
            { ok: false, error: 'File not found' },
            { status: 404 },
        )
    }
}
