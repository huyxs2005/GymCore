import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

function WeekdayDropdown({ id, label, value, options, onChange, summaryText = '' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const fallbackId = useId()
  const controlId = id || `weekday-dropdown-${fallbackId}`
  const labelId = `${controlId}-label`
  const listboxId = `${controlId}-listbox`
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0] || null

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(nextValue) {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div className="relative" ref={rootRef}>
      <label id={labelId} htmlFor={controlId} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>
      <button
        id={controlId}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={`mt-1.5 flex w-full min-w-52 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
          open
            ? 'border-gym-500 bg-gym-500/10 ring-2 ring-gym-200'
            : 'border-white/10 bg-[rgba(18,18,26,0.92)] hover:border-gym-500/30 hover:bg-white/5'
        }`}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{selectedOption?.label || 'Select weekday'}</div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">{selectedOption?.meta || summaryText || 'Choose a weekday summary to review.'}</div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180 text-gym-600' : ''}`}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute left-0 top-[calc(100%+0.65rem)] z-30 w-full overflow-hidden rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-2xl shadow-slate-900/10"
        >
          <div className="border-b border-white/10 bg-gradient-to-r from-gym-50 via-white to-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p className="mt-1 text-sm text-slate-400">Switch between weekdays without expanding the full slot wall.</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((option) => {
              const active = String(option.value) === String(selectedOption?.value)
              return (
                <button
                  key={`${controlId}-option-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    active
                      ? 'bg-gym-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{option.label}</div>
                    <div className={`mt-0.5 truncate text-xs ${active ? 'text-gym-50/90' : 'text-zinc-500'}`}>
                      {option.meta}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {option.badge ? (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>
                        {option.badge}
                      </span>
                    ) : null}
                    {active ? <Check size={16} className="shrink-0" /> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WeekdayDropdown




