'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface DayRow {
  date: string
  revenue: number
  newRevenue: number
  repeatRevenue: number
  spend: number
  clicks: number
}

const SERIES_LABELS: Record<string, string> = {
  spend: 'Ad Spend',
  newRevenue: 'New Revenue',
  repeatRevenue: 'Returning Revenue',
}

interface Creative {
  adId: string
  adName: string
  clicks: number
  primaryText: string | null
  mediaUrl: string | null
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

function formatCurrency(value: number) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function CreativesModal({ date, onClose }: { date: string; onClose: () => void }) {
  const [creatives, setCreatives] = useState<Creative[] | null>(null)
  const [loading, setLoading] = useState(true)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/creatives?date=${date}`)
      .then((r) => r.json())
      .then((data) => setCreatives(Array.isArray(data) ? data : []))
      .catch(() => setCreatives([]))
      .finally(() => setLoading(false))
  }, [date])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Top Creatives by Clicks</h3>
        <p className="text-xs text-gray-400 mb-4">{formatDate(date)}</p>

        {loading && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-40 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {!loading && (!creatives || creatives.length === 0) && (
          <p className="text-sm text-gray-400 text-center py-6">No creatives with clicks found for this day.</p>
        )}

        {!loading && creatives && creatives.length > 0 && (
          <div className="space-y-5">
            {creatives.map((c, i) => (
              <div key={c.adId} className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">#{i + 1} {c.adName}</span>
                  <span className="text-xs text-indigo-600 font-semibold">{c.clicks.toLocaleString()} clicks</span>
                </div>
                {c.mediaUrl && (
                  <img
                    src={c.mediaUrl}
                    alt="Ad creative"
                    className="w-full rounded-lg object-cover max-h-56"
                  />
                )}
                {c.primaryText && (
                  <p className="text-sm text-gray-700 leading-relaxed" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>{c.primaryText}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string; payload: DayRow }[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  const row = payload[0]?.payload
  const hasClicks = (row?.clicks ?? 0) > 0
  const totalRevenue = (row?.newRevenue ?? 0) + (row?.repeatRevenue ?? 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 text-[13px]" style={{ minWidth: 190 }}>
      <p className="font-medium text-gray-700 mb-2">{label ? formatDate(String(label)) : ''}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 text-gray-600">
          <span>{SERIES_LABELS[p.name] ?? p.name}</span>
          <span className="font-medium">{formatCurrency(Number(p.value))}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 text-gray-700 mt-1 pt-1 border-t border-gray-100">
        <span>Total Revenue</span>
        <span className="font-semibold">{formatCurrency(totalRevenue)}</span>
      </div>
      {hasClicks && (
        <p className="mt-2 text-[11px] text-indigo-500">Click the yellow bar for the top 2 creatives</p>
      )}
    </div>
  )
}

export default function Chart({ data }: { data: DayRow[] }) {
  const [modalDate, setModalDate] = useState<string | null>(null)

  const handleChartClick = useCallback((chartData: { activePayload?: { payload: DayRow }[] } | null) => {
    if (!chartData?.activePayload?.length) return
    const row = chartData.activePayload[0].payload
    if ((row.clicks ?? 0) > 0) {
      setModalDate(row.date)
    }
  }, [])

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No data for this period
      </div>
    )
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={data}
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          onClick={handleChartClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => SERIES_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 13 }}
          />
          <Bar dataKey="spend" stackId="spend" fill="#fbbf24" opacity={0.8} radius={[3, 3, 0, 0]} name="spend" />
          <Bar dataKey="repeatRevenue" stackId="rev" fill="#10b981" name="repeatRevenue" />
          <Bar dataKey="newRevenue" stackId="rev" fill="#6366f1" radius={[3, 3, 0, 0]} name="newRevenue" />
        </ComposedChart>
      </ResponsiveContainer>

      {modalDate && (
        <CreativesModal date={modalDate} onClose={() => setModalDate(null)} />
      )}
    </>
  )
}
