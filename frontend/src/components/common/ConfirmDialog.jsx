import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  pending = false,
  onConfirm,
  onCancel,
}) {
  if (!open || typeof document === 'undefined') return null

  const toneClasses = tone === 'danger'
    ? {
        icon: 'border border-rose-500/20 bg-rose-500/10 text-rose-300',
        confirm: 'bg-rose-500 hover:bg-rose-400 text-slate-950',
      }
    : {
        icon: 'border border-gym-300/30 bg-gym-50 text-gym-700',
        confirm: 'bg-gym-500 hover:brightness-110 text-slate-950 shadow-glow',
      }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.94)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses.icon}`}>
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Confirm action</p>
              <h2 id="confirm-dialog-title" className="mt-2 font-display text-xl font-bold tracking-tight text-slate-50">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-50"
            aria-label="Close confirmation dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${toneClasses.confirm}`}
          >
            {pending ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ConfirmDialog
