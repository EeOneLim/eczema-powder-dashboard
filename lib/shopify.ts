export interface ShopifyDay {
  date: string
  revenue: number
  orders: number
}

export interface ShopifyMetrics {
  total_revenue: number
  total_orders: number
  daily: ShopifyDay[]
}

export async function getShopifyMetrics(
  startDate: string,
  endDate: string
): Promise<ShopifyMetrics> {
  const token = process.env.SHOPIFY_ADMIN_TOKEN
  const store = process.env.SHOPIFY_STORE

  if (!token) throw new Error('Shopify not connected — visit /setup to connect')
  if (!store) throw new Error('SHOPIFY_STORE env var not set')

  // Convert Singapore date boundaries to UTC for the Shopify query.
  // Shopify returns created_at in the store's local timezone (SGT, UTC+8),
  // so we must query in UTC to avoid fetching orders from adjacent SGT days.
  // Using new Date(...+08:00).toISOString() avoids the + sign in the URL
  // (which some servers decode as a space, breaking the timezone offset).
  const startUTC = new Date(startDate + 'T00:00:00+08:00').toISOString().slice(0, 19) + 'Z'
  const endUTC   = new Date(endDate   + 'T23:59:59+08:00').toISOString().slice(0, 19) + 'Z'

  const orders: Array<{ total_price: string; created_at: string }> = []
  let nextUrl: string | null =
    `https://${store}/admin/api/2024-01/orders.json` +
    `?status=any&created_at_min=${startUTC}&created_at_max=${endUTC}` +
    `&fields=total_price,created_at&limit=250`

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: { 'X-Shopify-Access-Token': token },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Shopify API ${res.status}: ${body}`)
    }
    const json = await res.json()
    orders.push(...json.orders)
    const link: string | null = res.headers.get('Link')
    const next: RegExpMatchArray | null = link?.match(/<([^>]+)>;\s*rel="next"/) ?? null
    nextUrl = next ? next[1] : null
  }

  const map = new Map<string, ShopifyDay>()
  for (const o of orders) {
    const date = o.created_at.slice(0, 10) // SGT date (Shopify returns in store's local timezone)
    if (date < startDate || date > endDate) continue // safety: skip any out-of-range dates
    const prev = map.get(date) ?? { date, revenue: 0, orders: 0 }
    prev.revenue += parseFloat(o.total_price)
    prev.orders += 1
    map.set(date, prev)
  }

  const daily = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))

  return {
    total_revenue: parseFloat(daily.reduce((s, d) => s + d.revenue, 0).toFixed(2)),
    total_orders: daily.reduce((s, d) => s + d.orders, 0),
    daily: daily.map((d) => ({ ...d, revenue: parseFloat(d.revenue.toFixed(2)) })),
  }
}
