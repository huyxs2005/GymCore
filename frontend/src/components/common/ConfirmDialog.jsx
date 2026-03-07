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
        icon: 'bg-rose-100 text-rose-600',
        confirm: 'bg-rose-600 hover:bg-rose-700 text-white',
      }
    : {
        icon: 'bg-gym-100 text-gym-700',
        confirm: 'bg-gym-600 hover:bg-gym-700 text-white',
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
        className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses.icon}`}>
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Confirm action</p>
              <h2 id="confirm-dialog-title" className="mt-2 text-xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close confirmation dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-300 ${toneClasses.confirm}`}
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
