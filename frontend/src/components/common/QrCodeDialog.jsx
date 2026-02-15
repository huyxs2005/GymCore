import { useEffect, useMemo, useState } from 'react'
import * as QRCode from 'qrcode'
import { X } from 'lucide-react'
import { authApi } from '../../features/auth/api/authApi'

function QrCodeDialog({ open, onClose }) {
  const [token, setToken] = useState('')
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
        setToken('')
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
        setToken(nextToken)
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

  const canCopy = useMemo(() => Boolean(token && navigator?.clipboard?.writeText), [token])

  async function handleCopy() {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(token)
    } catch {
      // Ignore.
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
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

        {token ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Token</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-900">{token}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!canCopy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Copy token
              </button>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="ml-auto rounded-lg bg-gym-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default QrCodeDialog
