import { NextRequest } from 'next/server'

// TEMPORARY debug endpoint — inspects new-vs-returning classification for a
// single day. Gated by the normal dashboard auth (proxy requires dash_auth).
// Remove after debugging.
export async function GET(request: NextRequest) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN
  const store = process.env.SHOPIFY_STORE
  if (!token || !store) {
    return Response.json({ error: 'Shopify not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // YYYY-MM-DD (SGT)
  if (!date) return Response.json({ error: 'missing ?date=YYYY-MM-DD' }, { status: 400 })

  const startUTC = new Date(date + 'T00:00:00+08:00').toISOString().slice(0, 19) + 'Z'
  const endUTC = new Date(date + 'T23:59:59+08:00').toISOString().slice(0, 19) + 'Z'

  const headers = { 'X-Shopify-Access-Token': token }
  const dayUrl =
    `https://${store}/admin/api/2024-01/orders.json` +
    `?status=any&created_at_min=${startUTC}&created_at_max=${endUTC}` +
    `&fields=id,total_price,created_at,customer&limit=250`

  const dayRes = await fetch(dayUrl, { headers, cache: 'no-store' })
  if (!dayRes.ok) {
    return Response.json({ error: `Shopify ${dayRes.status}`, body: await dayRes.text() }, { status: 500 })
  }
  const dayJson = await dayRes.json()
  const orders = dayJson.orders ?? []

  const out = []
  for (const o of orders) {
    const c = o.customer
    let earliestId: number | null = null
    let history: Array<{ id: number; created_at: string }> = []
    if (c?.id) {
      const luRes = await fetch(
        `https://${store}/admin/api/2024-01/orders.json` +
          `?status=any&customer_id=${c.id}&limit=250&fields=id,created_at`,
        { headers, cache: 'no-store' }
      )
      const luJson = await luRes.json()
      history = (luJson.orders ?? []).map((x: { id: number; created_at: string }) => ({
        id: x.id,
        created_at: x.created_at,
      }))
      if (history.length) {
        earliestId = history.reduce((a, b) =>
          Date.parse(b.created_at) < Date.parse(a.created_at) ? b : a
        ).id
      }
    }
    const isNew = !c
      ? true
      : c.orders_count === 1
        ? true
        : earliestId == null
          ? true
          : earliestId === o.id

    out.push({
      orderId: o.id,
      total: o.total_price,
      created_at: o.created_at,
      customerId: c?.id ?? null,
      customerName: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '(guest / no customer)',
      embeddedOrdersCount: c?.orders_count ?? null,
      lifetimeOrderCountFound: history.length || null,
      earliestOrderIdFound: earliestId,
      thisOrderIsEarliest: earliestId === o.id,
      classifiedAs: isNew ? 'NEW' : 'RETURNING',
      history,
    })
  }

  return Response.json({ date, orderCount: orders.length, orders: out }, { status: 200 })
}
