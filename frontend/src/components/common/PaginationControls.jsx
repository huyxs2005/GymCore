import { ArrowLeft, ArrowRight } from 'lucide-react'

function scrollToPaginationSection(trigger) {
  if (typeof window === 'undefined' || !trigger) return

  const section =
    trigger.closest('[data-pagination-section]') ||
    trigger.closest('section') ||
    trigger.closest('article') ||
    trigger.parentElement

  if (!section) return

  const top = section.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({
    top: Math.max(0, top),
    behavior: 'smooth',
  })
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  tone = 'light',
  className = '',
}) {
  if (totalPages <= 1) return null

  const isDark = tone === 'dark'
  const wrapperClass = isDark
    ? 'border-white/10 bg-white/5 text-slate-300'
    : 'border-slate-200 bg-white text-slate-700'
  const buttonClass = isDark
    ? 'border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:text-slate-600'
    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:text-slate-400'

  const handlePageChange = (nextPage, event) => {
    if (nextPage === currentPage) return
    onPageChange(nextPage)
    scrollToPaginationSection(event.currentTarget)
  }

  return (
    <div className={`flex items-center justify-end gap-3 ${className}`}>
      <div className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${wrapperClass}`}>
        Page {currentPage} / {totalPages}
      </div>
      <button
        type="button"
        onClick={(event) => handlePageChange(Math.max(1, currentPage - 1), event)}
        disabled={currentPage <= 1}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed ${buttonClass}`}
        aria-label="Previous page"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(event) => handlePageChange(Math.min(totalPages, currentPage + 1), event)}
        disabled={currentPage >= totalPages}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed ${buttonClass}`}
        aria-label="Next page"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default PaginationControls
