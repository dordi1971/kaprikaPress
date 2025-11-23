// app/api/admin/message/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PushAPI, CONSTANTS } from '@pushprotocol/restapi'
import { ethers } from 'ethers'

export const runtime = 'nodejs'

type AdminMessagePayload = {
    wallets?: string[]
    message?: string
}

// Cache the Push user instance across requests
let pushUserPromise: Promise<any> | null = null

async function getPushUser() {
    if (!pushUserPromise) {
        const pk = process.env.PUSH_CHANNEL_PRIVATE_KEY

        if (!pk) {
            throw new Error(
                'PUSH_CHANNEL_PRIVATE_KEY is not set in environment variables',
            )
        }

        const signer = new ethers.Wallet(pk)

        const envVar = (process.env.PUSH_ENV || 'staging').toLowerCase()
        const env =
            envVar === 'prod' || envVar === 'production'
                ? CONSTANTS.ENV.PROD
                : CONSTANTS.ENV.STAGING

        pushUserPromise = PushAPI.initialize(signer, { env })
    }

    return pushUserPromise
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as AdminMessagePayload

        const wallets =
            body.wallets?.map((w) => w.trim()).filter(Boolean) ?? []
        const message = (body.message || '').trim()

        if (!wallets.length) {
            return NextResponse.json(
                { ok: false, error: 'No recipient wallets provided' },
                { status: 400 },
            )
        }

        if (!message) {
            return NextResponse.json(
                { ok: false, error: 'Message is empty' },
                { status: 400 },
            )
        }

        const pushUser = await getPushUser()

        // Avoid insanely long pushes
        const truncated =
            message.length > 300 ? message.slice(0, 297) + '...' : message

        const title =
            process.env.PUSH_DEFAULT_TITLE || 'Kaprika Press ID'

        // Targeted / subset notifications:
        // user.channel.send([recipients], { notification: { title, body } })
        // Docs: https://comms.push.org/... 
        const res = await pushUser.channel.send(wallets, {
            notification: {
                title,
                body: truncated,
            },
            payload: {
                title,
                body: truncated,
                cta: '',
                embed: '',
            },
        })

        console.log('Push notifications sent:', {
            recipients: wallets,
            pushResponse: res,
        })

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error('Error in /api/admin/message:', err)
        return NextResponse.json(
            {
                ok: false,
                error: err?.message || 'Failed to send Push notification',
            },
            { status: 500 },
        )
    }
}
