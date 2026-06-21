import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const store = process.env.SHOPIFY_STORE
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

  if (!code) {
    return new Response('Missing code', { status: 400 })
  }
  if (!store || !clientId || !clientSecret) {
    return new Response('Missing Shopify env vars', { status: 500 })
  }

  const tokenRes = await fetch(`https://${store}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || !tokenData.access_token) {
    return new Response(`Token exchange failed: ${JSON.stringify(tokenData)}`, { status: 500 })
  }

  const token = tokenData.access_token as string

  return new Response(
    `<!DOCTYPE html>
<html>
<head><title>Shopify Connected</title></head>
<body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:0 24px">
  <h2 style="color:#16a34a">✓ Shopify connected successfully</h2>
  <p>Copy the token below and add it to your Vercel environment variables as <strong>SHOPIFY_ADMIN_TOKEN</strong>.</p>
  <p style="background:#f3f4f6;padding:12px 16px;border-radius:8px;font-family:monospace;word-break:break-all;font-size:13px">${token}</p>
  <p style="color:#6b7280;font-size:14px">⚠️ Keep this token private. Once you've copied it, go to your Vercel dashboard → Project Settings → Environment Variables → add SHOPIFY_ADMIN_TOKEN → redeploy.</p>
  <p><a href="/" style="color:#4f46e5">← Back to dashboard</a></p>
</body>
</html>`,
    {
      headers: { 'Content-Type': 'text/html' },
    }
  )
}
