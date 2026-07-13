import { NextRequest } from 'next/server'

export interface Creative {
  adId: string
  adName: string
  clicks: number
  primaryText: string | null
  mediaUrl: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date) {
    return Response.json({ error: 'Missing date' }, { status: 400 })
  }

  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID

  if (!token || !accountId) {
    return Response.json({ error: 'Meta not configured' }, { status: 500 })
  }

  const timeRange = encodeURIComponent(JSON.stringify({ since: date, until: date }))
  const insightsUrl =
    `https://graph.facebook.com/v19.0/act_${accountId}/insights` +
    `?time_range=${timeRange}&time_increment=1&level=ad&fields=ad_id,ad_name,clicks&limit=200&access_token=${token}`

  const insightsRes = await fetch(insightsUrl, { cache: 'no-store' })
  const insightsJson = await insightsRes.json()

  if (insightsJson.error) {
    return Response.json({ error: insightsJson.error.message }, { status: 500 })
  }

  const ads: { ad_id: string; ad_name: string; clicks: string }[] = insightsJson.data ?? []

  const withClicks = ads
    .map((a) => ({ ...a, clicksNum: parseInt(a.clicks ?? '0') }))
    .filter((a) => a.clicksNum > 0)
    .sort((a, b) => b.clicksNum - a.clicksNum)
    .slice(0, 2)

  if (withClicks.length === 0) {
    return Response.json([])
  }

  const creatives: Creative[] = await Promise.all(
    withClicks.map(async (ad) => {
      const adRes = await fetch(
        `https://graph.facebook.com/v19.0/${ad.ad_id}?fields=creative{body,image_url,thumbnail_url,object_story_spec}&access_token=${token}`,
        { cache: 'no-store' }
      )
      const adJson = await adRes.json()
      const creative = adJson.creative ?? {}

      const primaryText: string | null =
        creative.body ??
        creative.object_story_spec?.link_data?.message ??
        creative.object_story_spec?.video_data?.message ??
        null

      const mediaUrl: string | null =
        creative.image_url ??
        creative.thumbnail_url ??
        creative.object_story_spec?.link_data?.picture ??
        null

      return {
        adId: ad.ad_id,
        adName: ad.ad_name,
        clicks: ad.clicksNum,
        primaryText,
        mediaUrl,
      }
    })
  )

  return Response.json(creatives)
}
