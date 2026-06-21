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

  const orders: Array<{ total_price: string; created_at: string }> = []
  let nextUrl: string | null =
    `https://${store}/admin/api/2024-01/orders.json` +
    `?status=any&created_at_min=${startDate}T00:00:00Z&created_at_max=${endDate}T23:59:59Z` +
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
    const date = o.created_at.slice(0, 10)
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
