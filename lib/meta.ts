export interface MetaDay {
  date: string
  spend: number
  impressions: number
  clicks: number
}

export interface MetaMetrics {
  total_spend: number
  total_impressions: number
  total_clicks: number
  daily: MetaDay[]
}

export async function getMetaMetrics(
  startDate: string,
  endDate: string
): Promise<MetaMetrics> {
  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID

  if (!token) throw new Error('META_ACCESS_TOKEN not configured')
  if (!accountId) throw new Error('META_AD_ACCOUNT_ID not configured')

  const timeRange = encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))
  const url =
    `https://graph.facebook.com/v19.0/act_${accountId}/insights` +
    `?time_range=${timeRange}&time_increment=1&fields=spend,impressions,clicks&access_token=${token}`

  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json()

  if (json.error) {
    const msg = json.error.message as string
    if (json.error.code === 190) {
      throw new Error('META_TOKEN_EXPIRED:' + msg)
    }
    throw new Error(`Meta API: ${msg}`)
  }

  const daily: MetaDay[] = (json.data ?? []).map(
    (d: Record<string, string>) => ({
      date: d.date_start,
      spend: parseFloat(d.spend ?? '0'),
      impressions: parseInt(d.impressions ?? '0'),
      clicks: parseInt(d.clicks ?? '0'),
    })
  )

  return {
    total_spend: parseFloat(daily.reduce((s, d) => s + d.spend, 0).toFixed(2)),
    total_impressions: daily.reduce((s, d) => s + d.impressions, 0),
    total_clicks: daily.reduce((s, d) => s + d.clicks, 0),
    daily,
  }
}
