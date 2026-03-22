import re

filepath = r'd:\Semester5\SWP391\GymCoreProject\GymCore\frontend\src\pages\admin\AdminReportsPage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Make the header block into the rich dark mode style
header_find = """        <section className="gc-card-compact space-y-6 overflow-hidden">
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
            >"""

header_replace = """        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_32%),linear-gradient(135deg,_rgba(18,18,26,0.98),_rgba(10,10,15,0.92))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Reports</p>
              <h2 className="mt-2 text-3xl font-black text-white">Revenue analysis</h2>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                Use short presets for common windows or apply an exact custom range. The chart, KPI cards, daily ledger,
                and Excel export all follow the same applied filter.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={revenueQuery.isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
            >"""

text = text.replace(header_find, header_replace)

# Apply global dark mode class conversions
text = text.replace('text-slate-900', 'text-white')
text = text.replace('text-slate-700', 'text-slate-300')
text = text.replace('text-slate-600', 'text-slate-400')
text = text.replace('text-slate-500', 'text-slate-400')
text = text.replace('text-gym-900', 'text-white')

text = text.replace('border-slate-200', 'border-white/10')
text = text.replace('border-slate-100', 'border-white/5')
text = text.replace('border-gym-200', 'border-gym-500/50')

text = text.replace('bg-white/70', 'bg-white/5')
text = text.replace('bg-white', 'bg-white/5')
text = text.replace('bg-slate-50/80', 'bg-white/5')
text = text.replace('bg-slate-50/70', 'bg-white/5')
text = text.replace('bg-slate-50/60', 'bg-white/5')
text = text.replace('bg-slate-50', 'bg-[#15151e]')
text = text.replace('bg-slate-100', 'bg-white/10')

text = text.replace('hover:bg-slate-50', 'hover:bg-white/10')
text = text.replace('hover:border-gym-100', 'hover:border-gym-500/50')
text = text.replace('hover:border-gym-200', 'hover:border-gym-500/50')
text = text.replace('hover:text-gym-700', 'hover:text-gym-400')
text = text.replace('bg-gym-50 ', 'bg-gym-500/20 ')

# Specific component tones replacements for metric cards:
# MetricCard tones
text = text.replace('tone="bg-blue-50 text-blue-700"', 'tone="bg-blue-500/20 text-blue-300"')
text = text.replace('tone="bg-emerald-50 text-emerald-700"', 'tone="bg-emerald-500/20 text-emerald-300"')
text = text.replace('tone="bg-amber-50 text-amber-700"', 'tone="bg-amber-500/20 text-amber-300"')
text = text.replace('tone="bg-gym-50 text-gym-700"', 'tone="bg-gym-500/20 text-gym-300"')

# DailyLedgerRow colors
# text-slate-something already addressed
# we just need to ensure background colors inside rows are okay.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Rewrite applied!")
