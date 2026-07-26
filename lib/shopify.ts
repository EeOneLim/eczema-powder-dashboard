export interface ShopifyDay {
  date: string
  revenue: number
  newRevenue: number
  repeatRevenue: number
  orders: number
  newOrders: number
  repeatOrders: number
}

export interface ShopifyMetrics {
  total_revenue: number
  total_new_revenue: number
  total_repeat_revenue: number
  total_orders: number
  total_new_orders: number
  total_repeat_orders: number
  daily: ShopifyDay[]
}

interface RawOrder {
  id: number
  total_price: string
  created_at: string
  customer: { id: number; orders_count?: number } | null
}

// Shopify REST allows ~2 requests/second; bursting past it returns 429.
// Retry on 429, honoring the Retry-After header, so the per-customer
// lookups below can't sink the whole request.
async function shopifyFetch(url: string, token: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
      cache: 'no-store',
    })
    if (res.status !== 429 || attempt >= 6) return res
    const retryAfter = parseFloat(res.headers.get('Retry-After') ?? '1')
    await new Promise((r) => setTimeout(r, Math.max(retryAfter, 0.5) * 1000))
  }
}

// Find a customer's lifetime-earliest order id (across all time, not just the
// requested window) so we can tell which of their orders was their first.
// We fetch the customer's orders and compute the minimum created_at ourselves
// rather than relying on the REST orders endpoint's `order` sort param, which
// is not honored reliably (it commonly returns newest-first regardless).
async function fetchEarliestOrderId(
  customerId: number,
  store: string,
  token: string
): Promise<number | null> {
  const url =
    `https://${store}/admin/api/2024-01/orders.json` +
    `?status=any&customer_id=${customerId}&limit=250&fields=id,created_at`
  const res = await shopifyFetch(url, token)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Shopify API ${res.status}: ${body}`)
  }
  const json = await res.json()
  const list: Array<{ id: number; created_at: string }> = json.orders ?? []
  if (!list.length) return null
  return list.reduce((earliest, o) =>
    Date.parse(o.created_at) < Date.parse(earliest.created_at) ? o : earliest
  ).id
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

  const orders: RawOrder[] = []
  let nextUrl: string | null =
    `https://${store}/admin/api/2024-01/orders.json` +
    `?status=any&created_at_min=${startUTC}&created_at_max=${endUTC}` +
    `&fields=id,total_price,created_at,customer&limit=250`

  while (nextUrl) {
    const res: Response = await shopifyFetch(nextUrl, token)
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

  // Decide which customers need an earliest-order lookup. We only skip the
  // lookup when orders_count is *exactly* 1 (provably a single-order customer,
  // so this order is their first). Any other value — including a missing count —
  // gets the lookup, so we never mislabel a returning order as new by default.
  const needLookup = new Set<number>()
  for (const o of orders) {
    if (o.customer && o.customer.orders_count !== 1) {
      needLookup.add(o.customer.id)
    }
  }
  const earliestOrderId = new Map<number, number | null>()
  const lookupIds = [...needLookup]
  // Bound concurrency so we stay near Shopify's ~2 req/sec ceiling; the 429
  // retry in shopifyFetch is the backstop if we still burst over it.
  const CONCURRENCY = 2
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, lookupIds.length) }, async () => {
      while (cursor < lookupIds.length) {
        const id = lookupIds[cursor++]
        earliestOrderId.set(id, await fetchEarliestOrderId(id, store, token))
      }
    })
  )

  const map = new Map<string, ShopifyDay>()
  for (const o of orders) {
    const date = o.created_at.slice(0, 10) // SGT date (Shopify returns in store's local timezone)
    if (date < startDate || date > endDate) continue // safety: skip any out-of-range dates
    const price = parseFloat(o.total_price)

    // Guest orders (no customer) count as new. Single-order customers are new.
    // Otherwise it's new only if this order is that customer's lifetime-earliest.
    let isNew: boolean
    if (!o.customer) {
      isNew = true
    } else if (o.customer.orders_count === 1) {
      isNew = true
    } else {
      const earliest = earliestOrderId.get(o.customer.id)
      isNew = earliest == null ? true : earliest === o.id
    }

    const prev =
      map.get(date) ??
      { date, revenue: 0, newRevenue: 0, repeatRevenue: 0, orders: 0, newOrders: 0, repeatOrders: 0 }
    prev.revenue += price
    prev.orders += 1
    if (isNew) {
      prev.newRevenue += price
      prev.newOrders += 1
    } else {
      prev.repeatRevenue += price
      prev.repeatOrders += 1
    }
    map.set(date, prev)
  }

  const daily = Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      revenue: parseFloat(d.revenue.toFixed(2)),
      newRevenue: parseFloat(d.newRevenue.toFixed(2)),
      repeatRevenue: parseFloat(d.repeatRevenue.toFixed(2)),
    }))

  const sum = (pick: (d: ShopifyDay) => number) =>
    parseFloat(daily.reduce((s, d) => s + pick(d), 0).toFixed(2))

  return {
    total_revenue: sum((d) => d.revenue),
    total_new_revenue: sum((d) => d.newRevenue),
    total_repeat_revenue: sum((d) => d.repeatRevenue),
    total_orders: daily.reduce((s, d) => s + d.orders, 0),
    total_new_orders: daily.reduce((s, d) => s + d.newOrders, 0),
    total_repeat_orders: daily.reduce((s, d) => s + d.repeatOrders, 0),
    daily,
  }
}
