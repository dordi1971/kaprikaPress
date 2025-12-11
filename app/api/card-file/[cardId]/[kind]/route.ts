// app/api/card-file/[cardId]/[kind]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    // URL looks like: /api/card-file/<cardId>/<kind>
    // e.g.           /api/card-file/551719785/image
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    // ['api', 'card-file', '{cardId}', '{kind}']

    if (segments.length < 4) {
        return NextResponse.json(
            { ok: false, error: 'Invalid URL' },
            { status: 400 },
        )
    }

    const cardId = segments[2]
    const kind = segments[3]

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
