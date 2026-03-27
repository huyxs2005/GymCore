import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import * as QRCode from 'qrcode'
import { X } from 'lucide-react'
import { authApi } from '../../features/auth/api/authApi'

function QrCodeDialog({ open, onClose }) {
  const [qrUrl, setQrUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function run() {
      try {
        setError('')
        setIsLoading(true)
        setQrUrl('')

        const response = await authApi.getMyQrToken()
        const nextToken = response?.data?.qrCodeToken || ''
        if (!nextToken) {
          throw new Error('Missing QR token.')
        }

        const dataUrl = await QRCode.toDataURL(nextToken, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 256,
        })

        if (cancelled) return
        setQrUrl(dataUrl)
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load QR code.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const content = (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your Check-in QR</h2>
            <p className="mt-1 text-sm text-slate-600">Show this code to the receptionist for check-in.</p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid place-items-center">
          {isLoading ? <p className="text-sm text-slate-600">Loading...</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {!isLoading && !error && qrUrl ? (
            <img src={qrUrl} alt="QR code" className="h-64 w-64 rounded-xl border border-slate-200 bg-white" />
          ) : null}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-lg bg-gym-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return null
  }
  return createPortal(content, document.body)
}

export default QrCodeDialog
