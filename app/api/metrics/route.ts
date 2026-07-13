import { NextRequest } from 'next/server'
import { getShopifyMetrics } from '@/lib/shopify'
import { getMetaMetrics } from '@/lib/meta'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) {
    return Response.json({ error: 'Missing start or end' }, { status: 400 })
  }

  const [shopifyResult, metaResult] = await Promise.allSettled([
    getShopifyMetrics(start, end),
    getMetaMetrics(start, end),
  ])

  const shopify = shopifyResult.status === 'fulfilled' ? shopifyResult.value : null
  const meta = metaResult.status === 'fulfilled' ? metaResult.value : null
  const errors = {
    shopify:
      shopifyResult.status === 'rejected'
        ? (shopifyResult.reason as Error).message
        : null,
    meta:
      metaResult.status === 'rejected'
        ? (metaResult.reason as Error).message
        : null,
  }

  // Build a complete set of every calendar date in the requested range,
  // so days with zero orders and zero spend still appear in the table.
  const allDates = new Set<string>()
  const cursor = new Date(start + 'T00:00:00Z')
  const last   = new Date(end   + 'T00:00:00Z')
  while (cursor <= last) {
    allDates.add(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  // Also include any dates the APIs returned outside the range (shouldn't happen, but be safe)
  for (const d of [...(shopify?.daily.map((d) => d.date) ?? []), ...(meta?.daily.map((d) => d.date) ?? [])]) {
    allDates.add(d)
  }

  const combined = Array.from(allDates)
    .sort()
    .map((date) => {
      const s = shopify?.daily.find((d) => d.date === date)
      const m = meta?.daily.find((d) => d.date === date)
      const revenue = s?.revenue ?? 0
      const spend = m?.spend ?? 0
      return {
        date,
        revenue,
        orders: s?.orders ?? 0,
        spend,
        clicks: m?.clicks ?? 0,
        roas: spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0,
      }
    })

  return Response.json({ shopify, meta, combined, errors })
}
