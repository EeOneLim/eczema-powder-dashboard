import { NextRequest } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const store = process.env.SHOPIFY_STORE
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!store || !clientId || !appUrl) {
    return Response.json(
      { error: 'Missing SHOPIFY_STORE, SHOPIFY_CLIENT_ID, or NEXT_PUBLIC_APP_URL' },
      { status: 500 }
    )
  }

  const state = crypto.randomBytes(16).toString('hex')
  const redirectUri = `${appUrl}/api/auth/shopify/callback`
  const scopes = 'read_orders,read_all_orders'

  const authUrl =
    `https://${store}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&grant_options[]=per-user`

  const response = Response.redirect(authUrl)
  return response
}
