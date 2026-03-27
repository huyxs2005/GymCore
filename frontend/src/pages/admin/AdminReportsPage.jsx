
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  FileSpreadsheet,
  Filter,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminApi } from '../../features/admin/api/adminApi'

const FILTER_MODES = [
  { value: 'quick', label: 'Quick range', description: 'Preset windows for fast admin checks.', icon: Sparkles },
  { value: 'custom', label: 'Custom range', description: 'Use exact start and end dates.', icon: CalendarRange },
]

const QUICK_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

function AdminReportsPage() {
  const [activeMode, setActiveMode] = useState('quick')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })
  const [appliedFilter, setAppliedFilter] = useState({ preset: '30d' })

  const revenueQuery = useQuery({
    queryKey: ['admin-revenue-overview', appliedFilter],
    queryFn: () => adminApi.getRevenueOverview(appliedFilter),
  })

  const report = revenueQuery.data?.data ?? {}
  const range = report.range ?? {}
  const tiles = report.tiles ?? {}
  const split = report.split ?? {}
  const series = report.series ?? []

  const maxRevenue = Math.max(...series.map((point) => Number(point.totalRevenue || 0)), 1)
  const averagePerDay = series.length === 0 ? 0 : Number(tiles.selectedRangeRevenue || 0) / series.length
  const activeRevenueDays = series.filter((point) => Number(point.totalRevenue || 0) > 0).length
  const peakDay = series.reduce(
    (best, point) => (Number(point.totalRevenue || 0) > Number(best.totalRevenue || 0) ? point : best),
    { date: null, membershipRevenue: 0, productRevenue: 0, totalRevenue: 0 },
  )
  const productShare =
    Number(tiles.selectedRangeRevenue || 0) === 0
      ? 0
      : (Number(split.products || 0) / Number(tiles.selectedRangeRevenue || 1)) * 100
  const membershipShare =
    Number(tiles.selectedRangeRevenue || 0) === 0
      ? 0
      : (Number(split.memberships || 0) / Number(tiles.selectedRangeRevenue || 1)) * 100
  const appliedSummary = buildAppliedSummary(range, appliedFilter)

  const applyQuickPreset = (preset) => {
    setAppliedFilter({ preset })
  }

  const applyCustomRange = () => {
    if (!customRange.from || !customRange.to) return
    if (customRange.from > customRange.to) {
      toast.error('From date must be on or before to date.')
      return
    }
    setAppliedFilter({ preset: 'custom', from: customRange.from, to: customRange.to })
  }

  const handleExport = async () => {
    try {
      const response = await adminApi.exportRevenueExcel(appliedFilter)
      const fileName =
        getDownloadFileName(response?.headers?.['content-disposition']) ||
        buildFallbackExportName(range, appliedFilter)
      const blob =
        response?.data instanceof Blob
          ? response.data
          : new Blob([response?.data], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
      toast.success(`Revenue export ready: ${fileName}`)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to export revenue Excel.')
    }
  }

  return (
    <WorkspaceScaffold
      title="Revenue Reports"
      subtitle="Single-mode revenue analysis with Excel export tied to the current filter."
      links={adminNav}
    >
      <div className="space-y-6">
        <section className="gc-card-compact space-y-6 overflow-hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Reports</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">Revenue analysis</h2>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">
                Use short presets for common windows or apply an exact custom range. The chart, KPI cards, daily ledger,
                and Excel export all follow the same applied filter.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={revenueQuery.isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FileSpreadsheet size={18} />
              Export Excel
            </button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                  <Filter size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Report mode</h3>
                  <p className="text-sm text-slate-500">Keep one active filter story at a time.</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {FILTER_MODES.map((mode) => {
                  const Icon = mode.icon
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setActiveMode(mode.value)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                        activeMode === mode.value
                          ? 'border-gym-200 bg-gym-50 text-gym-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-gym-100 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                        activeMode === mode.value ? 'bg-white text-gym-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Icon size={18} />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{mode.label}</span>
                        <span className="mt-1 block text-sm text-slate-500">{mode.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
              {activeMode === 'quick' ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Quick range</p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900">Preset reporting windows</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Apply a fast range without opening another control panel.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {QUICK_PRESETS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyQuickPreset(option.value)}
                        className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                          appliedFilter.preset === option.value
                            ? 'bg-gym-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-gym-200 hover:text-gym-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeMode === 'custom' ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Custom range</p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900">Exact start and end dates</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Narrow the report to a specific operational window and export that exact slice.
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <input
                      type="date"
                      aria-label="Custom range from"
                      value={customRange.from}
                      onChange={(event) => setCustomRange((current) => ({ ...current, from: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gym-300"
                    />
                    <input
                      type="date"
                      aria-label="Custom range to"
                      value={customRange.to}
                      onChange={(event) => setCustomRange((current) => ({ ...current, to: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gym-300"
                    />
                    <button
                      type="button"
                      onClick={applyCustomRange}
                      aria-label="Apply custom range"
                      disabled={!customRange.from || !customRange.to}
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Apply range
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[32px] bg-slate-900 px-6 py-5 text-white shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">Applied filter</p>
                <h3 className="mt-2 text-2xl font-black">{appliedSummary.title}</h3>
                <p className="mt-2 max-w-2xl text-sm text-white/75">{appliedSummary.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryChip label="Mode" value={appliedSummary.modeLabel} />
                <SummaryChip label="From" value={range.from || '--'} />
                <SummaryChip label="To" value={range.to || '--'} />
              </div>
            </div>
          </div>
        </section>

        {revenueQuery.error ? (
          <section className="gc-card-compact border border-rose-200 bg-rose-50/80">
            <h3 className="text-lg font-bold text-rose-900">Revenue data could not be loaded</h3>
            <p className="mt-2 text-sm text-rose-700">
              {revenueQuery.error?.response?.data?.message || 'Refresh the page or retry once the backend is available.'}
            </p>
          </section>
        ) : null}

        {revenueQuery.isLoading && !revenueQuery.data ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[28px] border border-slate-100 bg-white" />
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total revenue"
            value={tiles.selectedRangeRevenue}
            subtitle="Selected applied range"
            tone="bg-gym-50 text-gym-700"
            icon={<TrendingUp size={18} />}
          />
          <MetricCard
            label="Membership revenue"
            value={split.memberships}
            subtitle="Membership checkout flow"
            tone="bg-blue-50 text-blue-700"
            icon={<CalendarDays size={18} />}
          />
          <MetricCard
            label="Product revenue"
            value={split.products}
            subtitle="Shop and pickup orders"
            tone="bg-emerald-50 text-emerald-700"
            icon={<ShoppingBag size={18} />}
          />
          <MetricCard
            label="Average per day"
            value={averagePerDay}
            subtitle={`${activeRevenueDays} days with revenue activity`}
            tone="bg-amber-50 text-amber-700"
            icon={<BarChart3 size={18} />}
          />
        </section>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <div className="gc-card-compact space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Trend</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Revenue movement</h3>
                <p className="mt-2 text-sm text-slate-500">
                  One chart for the active range. No duplicate revenue cards on this page.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                {series.length} days in scope
              </span>
            </div>

            <div className="rounded-[32px] bg-slate-50/80 px-5 py-6">
              <div className="flex h-80 items-end gap-2 overflow-x-auto">
                {series.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white text-sm text-slate-400">
                    No successful payments in this range.
                  </div>
                ) : (
                  series.map((point) => (
                    <div key={point.date} className="flex min-w-[44px] flex-1 flex-col items-center justify-end gap-3">
                      <span className="text-[10px] font-semibold text-slate-500">{formatCurrency(point.totalRevenue)}</span>
                      <div className="flex h-[220px] w-full items-end rounded-3xl bg-white/70 px-1 pb-1 shadow-inner">
                        <div
                          className="w-full rounded-[20px] bg-gradient-to-t from-gym-600 via-gym-500 to-emerald-300 transition hover:from-gym-700 hover:via-gym-600 hover:to-emerald-400"
                          style={{
                            height: `${Math.max((Number(point.totalRevenue || 0) / maxRevenue) * 205, 10)}px`,
                          }}
                          title={`${point.date}: ${formatCurrency(point.totalRevenue)}`}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">{formatCompactDate(point.date)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <InsightPill
                label="Peak day"
                value={peakDay?.date ? formatLongDate(peakDay.date) : 'No revenue yet'}
                detail={peakDay?.date ? formatCurrency(peakDay.totalRevenue) : '0 VND'}
              />
              <InsightPill
                label="Active days"
                value={`${activeRevenueDays}/${series.length || 0}`}
                detail="Days with successful payments"
              />
              <InsightPill
                label="Export scope"
                value={appliedSummary.title}
                detail="Excel follows this exact filter"
              />
            </div>
          </div>

          <div className="space-y-6">
            <section className="gc-card-compact space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Mix</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Revenue composition</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Clean split for the applied range instead of another dense table.
                </p>
              </div>

              <RevenueMixRow
                label="Memberships"
                value={split.memberships}
                percentage={membershipShare}
                accent="bg-blue-500"
                track="bg-blue-100"
              />
              <RevenueMixRow
                label="Products"
                value={split.products}
                percentage={productShare}
                accent="bg-emerald-500"
                track="bg-emerald-100"
              />
            </section>

            <section className="gc-card-compact space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Reference</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Quick benchmarks</h3>
              </div>

              <ReferenceRow label="Today" value={tiles.todayRevenue} />
              <ReferenceRow label="Last 7 days" value={tiles.last7DaysRevenue} />
              <ReferenceRow label="Month to date" value={tiles.monthToDateRevenue} />
            </section>
          </div>
        </section>

        <section className="gc-card-compact space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Daily ledger</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">Revenue by day</h3>
              <p className="mt-2 text-sm text-slate-500">
                Compact daily rows for on-screen review. Use Excel when you need the full operational sheet outside the browser.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              {series.length} rows in current range
            </span>
          </div>

          <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
            {series.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center text-sm text-slate-400">
                No revenue rows in this range.
              </div>
            ) : (
              series.map((point) => <DailyLedgerRow key={point.date} point={point} maxTotal={maxRevenue} />)
            )}
          </div>
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function MetricCard({ label, value, subtitle, tone, icon }) {
  return (
    <article className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{label}</p>
          <h3 className="mt-3 text-3xl font-black text-slate-900">{formatCurrency(value)}</h3>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>{icon}</span>
      </div>
    </article>
  )
}

function SummaryChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function InsightPill({ label, value, detail }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/80 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  )
}
function RevenueMixRow({ label, value, percentage, accent, track }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="mt-1 text-sm text-slate-500">{percentage.toFixed(1)}% of selected revenue</p>
        </div>
        <p className="text-sm font-black text-slate-900">{formatCurrency(value)}</p>
      </div>
      <div className={`mt-3 h-3 overflow-hidden rounded-full ${track}`}>
        <div className={`${accent} h-full rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  )
}

function ReferenceRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50/70 px-4 py-4">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-900">{formatCurrency(value)}</span>
    </div>
  )
}

function DailyLedgerRow({ point, maxTotal }) {
  const total = Number(point.totalRevenue || 0)
  const membership = Number(point.membershipRevenue || 0)
  const products = Number(point.productRevenue || 0)
  const membershipShare = total === 0 ? 0 : (membership / total) * 100
  const productShare = total === 0 ? 0 : (products / total) * 100
  const intensity = Math.max((total / maxTotal) * 100, total > 0 ? 8 : 2)

  return (
    <div className="grid gap-4 rounded-[28px] border border-slate-100 bg-white px-5 py-4 shadow-sm lg:grid-cols-[180px_minmax(0,1fr)_150px] lg:items-center">
      <div>
        <p className="text-sm font-bold text-slate-900">{formatLongDate(point.date)}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{point.date}</p>
      </div>

      <div className="space-y-3">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full" style={{ width: `${Math.min(intensity, 100)}%` }}>
            <span className="h-full bg-blue-500" style={{ width: `${membershipShare}%` }} />
            <span className="h-full bg-emerald-500" style={{ width: `${productShare}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Memberships {formatCurrency(point.membershipRevenue)}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Products {formatCurrency(point.productRevenue)}
          </span>
        </div>
      </div>

      <div className="text-left lg:text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Total</p>
        <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(point.totalRevenue)}</p>
      </div>
    </div>
  )
}

function buildAppliedSummary(range, appliedFilter) {
  if (range?.from && range?.to) {
    const title = describeAppliedRange(range)
    return {
      title,
      modeLabel: describeMode(range.preset),
      description: `Range ${range.from} to ${range.to}. Excel export and on-screen analytics use this exact window.`,
    }
  }

  return {
    title: describePendingFilter(appliedFilter),
    modeLabel: describeMode(appliedFilter?.preset),
    description: 'Apply a report mode to lock the analytics, ledger, and Excel export to one date scope.',
  }
}

function describeAppliedRange(range) {
  switch (range?.preset) {
    case 'today':
      return 'Today'
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
    default:
      return `${range?.from || '--'} to ${range?.to || '--'}`
  }
}

function describePendingFilter(filter) {
  switch (filter?.preset) {
    case 'today':
      return 'Today'
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
    case 'custom':
      return filter?.from && filter?.to ? `${filter.from} to ${filter.to}` : 'Custom range'
    default:
      return 'Last 30 days'
  }
}

function describeMode(preset) {
  switch (preset) {
    case 'today':
    case '7d':
    case '30d':
      return 'Quick range'
    case 'custom':
      return 'Custom range'
    default:
      return 'Quick range'
  }
}
function getDownloadFileName(contentDisposition) {
  if (!contentDisposition) {
    return null
  }
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1])
  }
  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return basicMatch?.[1] || null
}

function buildFallbackExportName(range, appliedFilter) {
  if (range?.from && range?.to) {
    return `GymCore_Revenue_${range.from}_to_${range.to}.xlsx`
  }
  return `GymCore_Revenue_${describePendingFilter(appliedFilter).replace(/\s+/g, '_')}.xlsx`
}

function formatCompactDate(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function formatLongDate(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString()} VND`
}

export default AdminReportsPage
