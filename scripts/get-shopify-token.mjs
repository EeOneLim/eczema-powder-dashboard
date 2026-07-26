/**
 * One-time script to get your Shopify Admin offline access token.
 * Run with: node scripts/get-shopify-token.mjs
 *
 * It starts a temporary local server, opens Shopify OAuth in your browser,
 * captures the callback, and prints your permanent token.
 */

import http from 'http'
import { exec } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const env = {}
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim()
  }
} catch {
  console.error('Could not read .env.local — make sure it exists in the dashboard folder.')
  process.exit(1)
}

const STORE      = env.SHOPIFY_STORE
const CLIENT_ID  = env.SHOPIFY_CLIENT_ID
const SECRET     = env.SHOPIFY_CLIENT_SECRET
const PORT       = 9876
const REDIRECT   = `http://localhost:${PORT}/callback`

if (!STORE || !CLIENT_ID || !SECRET) {
  console.error('Missing SHOPIFY_STORE, SHOPIFY_CLIENT_ID, or SHOPIFY_CLIENT_SECRET in .env.local')
  process.exit(1)
}

const authUrl =
  `https://${STORE}/admin/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&scope=read_orders,read_all_orders` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&state=local`

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname !== '/callback') {
    res.end('waiting...')
    return
  }

  const code = url.searchParams.get('code')
  if (!code) {
    res.end('No code received. Try again.')
    server.close()
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<h2>Got it! Check your terminal for the token. You can close this tab.</h2>')

  // Exchange code for token
  const tokenRes = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: SECRET, code }),
  })
  const data = await tokenRes.json()

  server.close()

  if (data.access_token) {
    console.log('\n✅ Success! Your Shopify Admin token:\n')
    console.log('  ' + data.access_token)
    console.log('\nAdd this to:')
    console.log('  1. Your .env.local as SHOPIFY_ADMIN_TOKEN=<token>')
    console.log('  2. Vercel → Settings → Environment Variables → SHOPIFY_ADMIN_TOKEN')
    console.log('     then redeploy.\n')
  } else {
    console.error('Token exchange failed:', data)
  }
})

server.listen(PORT, () => {
  console.log(`\nOpening Shopify authorization in your browser...`)
  console.log(`(If it doesn't open, visit this URL manually:\n  ${authUrl}\n)`)

  // Open browser
  const open =
    process.platform === 'darwin' ? `open "${authUrl}"` :
    process.platform === 'win32' ? `start "" "${authUrl}"` :
    `xdg-open "${authUrl}"`

  exec(open)
})

console.log(`\nWaiting for Shopify callback on http://localhost:${PORT}...`)
