'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

interface DayRow {
  date: string
  revenue: number
  newRevenue: number
  repeatRevenue: number
  orders: number
  newOrders: number
  repeatOrders: number
  spend: number
  clicks: number
  roas: number
}

interface Metrics {
  shopify: {
    total_revenue: number
    total_new_revenue: number
    total_repeat_revenue: number
    total_orders: number
    total_new_orders: number
    total_repeat_orders: number
  } | null
  meta: { total_spend: number; total_impressions: number; total_clicks: number } | null
  combined: DayRow[]
  errors: { shopify: string | null; meta: string | null }
}

type Preset = '7' | '30' | '90'

function toDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPresetRange(days: number): [string, string] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  return [toDateStr(start), toDateStr(end)]
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtRoas(n: number) {
  return n > 0 ? n.toFixed(2) + '×' : '—'
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function formatTableDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const router = useRouter()
  const [preset, setPreset] = useState<Preset>('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = useCallback(async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/metrics?start=${start}&end=${end}`)
      const data = await res.json()
      setMetrics(data)
    } catch {
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (useCustom) {
      if (customStart && customEnd && customStart <= customEnd) {
        fetchMetrics(customStart, customEnd)
      }
    } else {
      const [start, end] = getPresetRange(parseInt(preset))
      fetchMetrics(start, end)
    }
  }, [preset, customStart, customEnd, useCustom, fetchMetrics])

  function handleLogout() {
    document.cookie = 'dash_auth=; max-age=0; path=/'
    router.push('/login')
  }

  const totalRevenue = metrics?.shopify?.total_revenue ?? 0
  const totalNewRevenue = metrics?.shopify?.total_new_revenue ?? 0
  const totalRepeatRevenue = metrics?.shopify?.total_repeat_revenue ?? 0
  const totalNewOrders = metrics?.shopify?.total_new_orders ?? 0
  const totalRepeatOrders = metrics?.shopify?.total_repeat_orders ?? 0
  const totalSpend = metrics?.meta?.total_spend ?? 0
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Eczema Powder</h1>
          <p className="text-xs text-gray-500">Ads &amp; Sales Dashboard</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Error banners */}
        {metrics?.errors.shopify && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>Shopify:</strong>{' '}
            {metrics.errors.shopify.includes('not connected') ? (
              <>Not connected. <a href="/setup" className="underline">Complete setup →</a></>
            ) : (
              metrics.errors.shopify
            )}
          </div>
        )}
        {metrics?.errors.meta && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            <strong>Meta:</strong>{' '}
            {metrics.errors.meta.includes('META_TOKEN_EXPIRED')
              ? 'Access token expired. Go to developers.facebook.com/tools/explorer to generate a new token and update META_ACCESS_TOKEN in Vercel.'
              : metrics.errors.meta}
          </div>
        )}

        {/* Date range selector */}
        <div className="flex flex-wrap items-center gap-2">
          {(['7', '30', '90'] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPreset(p); setUseCustom(false) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !useCustom && preset === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              Last {p} days
            </button>
          ))}
          <span className="text-gray-300 hidden sm:block">|</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true) }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true) }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Summary cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="New Customer Rev"
              value={fmt(totalNewRevenue)}
              sub={`${totalNewOrders} first-time orders`}
              color="text-indigo-600"
            />
            <SummaryCard
              label="Returning Rev"
              value={fmt(totalRepeatRevenue)}
              sub={`${totalRepeatOrders} repeat orders`}
              color="text-emerald-600"
            />
            <SummaryCard
              label="Ad Spend"
              value={fmt(totalSpend)}
              sub={`${(metrics?.meta?.total_clicks ?? 0).toLocaleString()} clicks`}
              color="text-amber-600"
            />
            <SummaryCard
              label="ROAS"
              value={fmtRoas(roas)}
              sub="Revenue ÷ Spend"
              color="text-purple-600"
            />
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ad Spend vs Revenue (New + Returning)</h2>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded-lg" />
          ) : (
            <Chart data={metrics?.combined ?? []} />
          )}
        </div>

        {/* Daily table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Daily Breakdown</h2>
          </div>
          {loading ? (
            <div className="p-6 animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Date</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">New Rev</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Returning Rev</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Total Rev</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Ad Spend</th>
                    <th className="px-6 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(metrics?.combined ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                        No data for this period
                      </td>
                    </tr>
                  ) : (
                    [...(metrics?.combined ?? [])].reverse().map((row) => (
                      <tr key={row.date} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-gray-700">{formatTableDate(row.date)}</td>
                        <td className="px-6 py-3 text-right text-indigo-700 font-medium">{fmt(row.newRevenue)}</td>
                        <td className="px-6 py-3 text-right text-emerald-700 font-medium">{fmt(row.repeatRevenue)}</td>
                        <td className="px-6 py-3 text-right text-gray-700 font-medium">{fmt(row.revenue)}</td>
                        <td className="px-6 py-3 text-right text-amber-700">{fmt(row.spend)}</td>
                        <td className="px-6 py-3 text-right text-purple-700 font-medium">{fmtRoas(row.roas)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          Revenue from Shopify orders · Ad Spend from Meta · ROAS = Revenue ÷ Ad Spend (blended)
        </p>
      </main>
    </div>
  )
}
