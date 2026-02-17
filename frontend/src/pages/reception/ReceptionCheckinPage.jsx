import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { useEffect, useMemo, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { receptionCheckinApi } from '../../features/checkin/api/receptionCheckinApi'
import { receptionCustomerApi } from '../../features/users/api/receptionCustomerApi'
import { receptionNav } from '../../config/navigation'

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

function formatCheckinTimeVn(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(parsed)
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${valueByType.day}/${valueByType.month}/${valueByType.year} ${valueByType.hour}:${valueByType.minute}`
}

function ReceptionCheckinPage() {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedValidity, setSelectedValidity] = useState(null)
  const [searching, setSearching] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [scanPopup, setScanPopup] = useState(null)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectorTimerRef = useRef(null)
  const handlingScanRef = useRef(false)

  const cameraSupported = useMemo(() => {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }, [])

  async function refreshHistory() {
    setLoadingHistory(true)
    try {
      const response = await receptionCheckinApi.getHistory()
      setHistory(response?.data?.items || [])
    } catch {
      // Keep UI usable even if history fails.
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    refreshHistory()
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  function stopCamera() {
    if (detectorTimerRef.current) {
      window.clearInterval(detectorTimerRef.current)
      detectorTimerRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setCameraError('')
    setCameraOpen(false)
    setCameraReady(false)
    handlingScanRef.current = false
  }

  async function performCheckin(payload) {
    setCheckingIn(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await receptionCheckinApi.scan(payload)
      const data = response?.data || {}
      const formattedTime = formatCheckinTimeVn(data?.checkInTime)
      const successText = `Checked in ${data?.customer?.fullName || 'customer'} at ${formattedTime}.`
      setSuccessMessage(successText)
      if (selectedCustomer) {
        await loadMembershipValidity(selectedCustomer.customerId)
      }
      await refreshHistory()
      return { ok: true, data, message: successText }
    } catch (error) {
      const message = resolveApiMessage(error, 'Check-in failed.')
      setErrorMessage(message)
      return { ok: false, data: null, message }
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleQrTokenDetected(rawValue) {
    const token = (rawValue || '').trim()
    if (!token || handlingScanRef.current) {
      return
    }

    handlingScanRef.current = true
    stopCamera()
    const result = await performCheckin({ qrCodeToken: token })
    setScanPopup({
      ok: result.ok,
      message: result.message,
    })
    handlingScanRef.current = false
  }

  function decodeFromCenterSquareFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null
    }

    const side = Math.min(video.videoWidth, video.videoHeight)
    if (side <= 0) {
      return null
    }

    const sx = Math.floor((video.videoWidth - side) / 2)
    const sy = Math.floor((video.videoHeight - side) / 2)

    canvas.width = side
    canvas.height = side
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return null
    }

    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side)
    const imageData = ctx.getImageData(0, 0, side, side)
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })
    return decoded?.data || null
  }

  function startScanLoop(detector) {
    if (detectorTimerRef.current) {
      window.clearInterval(detectorTimerRef.current)
    }

    detectorTimerRef.current = window.setInterval(async () => {
      if (handlingScanRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        return
      }

      try {
        if (detector) {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes?.length) {
            await handleQrTokenDetected(barcodes[0].rawValue || '')
          }
          return
        }

        const token = decodeFromCenterSquareFrame()
        if (token) {
          await handleQrTokenDetected(token)
        }
      } catch {
        // Ignore per-frame decode errors.
      }
    }, 350)
  }

  async function openCamera() {
    if (!cameraSupported) {
      setCameraError('Camera is not supported in this browser.')
      return
    }

    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      video.srcObject = stream
      await video.play()
      streamRef.current = stream
      setCameraOpen(true)
      setCameraReady(true)

      const supportsBarcode = typeof window !== 'undefined' && typeof window.BarcodeDetector !== 'undefined'
      if (!supportsBarcode) {
        startScanLoop(null)
        return
      }

      let detector
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      } catch {
        startScanLoop(null)
        return
      }

      startScanLoop(detector)
    } catch {
      setCameraError('Cannot access camera. Please allow camera permission and retry.')
    }
  }

  async function loadMembershipValidity(customerId) {
    try {
      const response = await receptionCheckinApi.validateMembership(customerId)
      setSelectedValidity(response?.data || null)
    } catch (error) {
      setSelectedValidity(null)
      setErrorMessage(resolveApiMessage(error, 'Failed to load membership validity.'))
    }
  }

  async function runSearch(event) {
    event.preventDefault()
    setSearching(true)
    setErrorMessage('')
    setSuccessMessage('')
    setSelectedCustomer(null)
    setSelectedValidity(null)
    try {
      const response = await receptionCustomerApi.searchCustomers(query.trim())
      setCustomers(response?.data?.items || [])
    } catch (error) {
      setCustomers([])
      setErrorMessage(resolveApiMessage(error, 'Customer search failed.'))
    } finally {
      setSearching(false)
    }
  }

  async function selectCustomer(customer) {
    setSelectedCustomer(customer)
    await loadMembershipValidity(customer.customerId)
  }

  return (
    <WorkspaceScaffold
      title="Reception Check-in Scanner"
      subtitle="Scan customer QR on top or search by phone/name below. Membership errors are shown directly."
      links={receptionNav}
    >
      <section className="space-y-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">QR Check-in (Camera)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Open camera, point at customer QR, and check-in happens automatically.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {!cameraOpen ? (
              <button
                type="button"
                onClick={openCamera}
                className="rounded-md bg-gym-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gym-600"
              >
                Open camera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Stop camera
              </button>
            )}
          </div>

          <div className="mt-4">
            <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!cameraReady ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-200">
                  Camera preview
                </div>
              ) : null}
              {cameraReady ? (
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.38)]" />
              ) : null}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {cameraError ? <p className="mt-3 text-sm text-amber-700">{cameraError}</p> : null}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Manual Check-in (Search + Select)</h2>
          <p className="mt-1 text-sm text-slate-600">Search by customer full name or phone, then choose and check in.</p>

          <form onSubmit={runSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type name or phone"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="rounded-md bg-gym-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {customers.length === 0 ? (
              <p className="text-sm text-slate-500">No results yet.</p>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.customerId}
                  type="button"
                  onClick={() => selectCustomer(customer)}
                  className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                    selectedCustomer?.customerId === customer.customerId
                      ? 'border-gym-500 bg-gym-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <p className="font-semibold text-slate-900">{customer.fullName}</p>
                  <p className="text-slate-600">
                    {customer.phone || '-'} | {customer.email || '-'}
                  </p>
                </button>
              ))
            )}
          </div>

          {selectedCustomer ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Selected customer</h3>
              <p className="mt-1 text-sm text-slate-700">{selectedCustomer.fullName}</p>

              {selectedValidity ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className={selectedValidity.valid ? 'text-emerald-700' : 'text-rose-700'}>
                    {selectedValidity.valid ? 'Membership valid for check-in.' : selectedValidity.reason}
                  </p>
                  {selectedValidity.membership?.customerMembershipId ? (
                    <p className="text-slate-600">
                      {selectedValidity.membership.planName} ({selectedValidity.membership.status}) |{' '}
                      {selectedValidity.membership.startDate} - {selectedValidity.membership.endDate}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                disabled={checkingIn}
                onClick={() => performCheckin({ customerId: selectedCustomer.customerId })}
                className="mt-3 rounded-md bg-gym-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingIn ? 'Checking in...' : 'Check in selected customer'}
              </button>
            </div>
          ) : null}
        </article>

        {successMessage ? (
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {successMessage}
          </article>
        ) : null}

        {errorMessage ? (
          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {errorMessage}
          </article>
        ) : null}

        {scanPopup ? (
          <div className="fixed right-5 top-5 z-[1100] w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className={`text-sm font-semibold ${scanPopup.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
              {scanPopup.ok ? 'Scan completed' : 'Scan failed'}
            </p>
            <p className="mt-1 text-sm text-slate-700">{scanPopup.message}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setScanPopup(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  setScanPopup(null)
                  await openCamera()
                }}
                className="rounded-md bg-gym-500 px-3 py-2 text-sm font-semibold text-white hover:bg-gym-600"
              >
                Scan next
              </button>
            </div>
          </div>
        ) : null}

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent check-ins</h2>
          {loadingHistory ? (
            <p className="mt-3 text-sm text-slate-500">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No check-in records yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Checked by</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.checkInId} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{formatCheckinTimeVn(item.checkInTime)}</td>
                      <td className="px-3 py-2 text-slate-700">{item.fullName || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{item.planName || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{item.checkedByName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </WorkspaceScaffold>
  )
}

export default ReceptionCheckinPage
