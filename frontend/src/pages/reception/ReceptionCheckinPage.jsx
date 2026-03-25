import { useEffect, useMemo, useRef, useState } from 'react'
import { QrCode, Search, Camera, CameraOff, History, CheckCircle2, AlertCircle, User, X, ShieldAlert, MonitorCheck, Loader2 } from 'lucide-react'
import jsQR from 'jsqr'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
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
      title="Access Control Terminal"
      subtitle="Main hub for customer check-in via QR synthesis or identity lookup. Monitoring active membership validity in real-time."
      links={receptionNav}
    >
      <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">QR Synthesis Check-in</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Propagate customer access rights via automated vision scanning.
                  </p>
                </div>
                {!cameraOpen ? (
                  <button
                    type="button"
                    onClick={openCamera}
                    className="flex items-center gap-3 rounded-xl bg-gym-500 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-950 shadow-glow transition-all hover:scale-105 active:scale-95"
                  >
                    <Camera className="h-4 w-4" /> Start Vision Scan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-6 py-3 text-xs font-black uppercase tracking-widest text-white border border-white/10 transition-all hover:bg-white/10"
                  >
                    <CameraOff className="h-4 w-4" /> Deactivate Scanner
                  </button>
                )}
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-sm">
                <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-gym-500/20 via-transparent to-gym-500/10 blur-2xl opacity-50" />
                <div className="relative h-full w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 ring-1 ring-white/5">
                  <video ref={videoRef} className="h-full w-full object-cover opacity-60 mix-blend-screen" muted playsInline />
                  
                  {!cameraReady && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                      <div className="rounded-full bg-white/5 p-6 border border-white/5">
                        <QrCode className="h-12 w-12 text-slate-700" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Vision System Offline</p>
                    </div>
                  )}

                  {cameraReady && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                       <div className="relative h-64 w-64">
                          <div className="absolute inset-0 border-2 border-gym-500/40 rounded-3xl" />
                          <div className="absolute -inset-1 border-2 border-gym-500/20 rounded-[2rem] animate-pulse" />
                          
                          {/* Corner brackets */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-gym-500 rounded-tl-xl" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-gym-500 rounded-tr-xl" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-gym-500 rounded-bl-xl" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-gym-500 rounded-br-xl" />
                          
                          {/* Scanning bar */}
                          <div className="absolute top-0 left-4 right-4 h-1 bg-gym-500 shadow-glow animate-scan" />
                       </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <ShieldAlert className="h-10 w-10 text-rose-500 mb-4" />
                      <p className="text-sm font-bold text-rose-400 uppercase tracking-tight">System Access Denied</p>
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed">{cameraError}</p>
                    </div>
                  )}
                </div>
              </div>

              {cameraOpen && (
                <div className="mt-8 flex justify-center">
                   <div className="flex items-center gap-3 rounded-full bg-emerald-500/10 px-4 py-2 ring-1 ring-emerald-500/20">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-glow" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">System Processing Active</span>
                   </div>
                </div>
              )}
            </section>

            <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
              <div className="mb-8 items-start justify-between sm:flex">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Direct Inquiry</h2>
                  <p className="mt-1 text-sm text-slate-500">Locate customer credentials via database synchronization.</p>
                </div>
                <div className="hidden items-center gap-2 rounded-xl bg-white/5 px-4 py-2 border border-white/5 sm:flex">
                   <MonitorCheck className="h-4 w-4 text-slate-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Database Ready</span>
                </div>
              </div>

              <form onSubmit={runSearch} className="group relative">
                <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:ring-gym-500/50 focus-within:bg-white/5">
                  <div className="pl-4 text-slate-500 group-focus-within:text-gym-500">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Enter Customer Identity or Proxy..."
                    className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searching || !query.trim()}
                    className="flex h-12 items-center gap-2 rounded-xl bg-gym-500 px-8 text-xs font-black uppercase tracking-widest text-slate-950 shadow-glow disabled:opacity-20 disabled:shadow-none transition-all active:scale-95"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Synchronize'}
                  </button>
                </div>
              </form>

              <div className="mt-8 space-y-3">
                {searching ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/[0.01]" />
                    ))}
                  </div>
                ) : customers.length === 0 && query ? (
                   <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-12 text-center">
                     <p className="text-xs font-black uppercase tracking-widest text-slate-600">Zero matches found in active database.</p>
                   </div>
                ) : (
                  customers.map((customer) => (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className={`group w-full rounded-2xl border p-5 text-left transition-all duration-300 ${
                        selectedCustomer?.customerId === customer.customerId
                          ? 'border-gym-500 bg-gym-500/10 shadow-glow-sm'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-sm transition-colors ${selectedCustomer?.customerId === customer.customerId ? 'bg-gym-500 text-slate-950' : 'bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10'}`}>
                             <User className="h-5 w-5" />
                           </div>
                           <div>
                             <p className="font-display text-lg font-bold text-white tracking-tight">{customer.fullName}</p>
                             <p className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-400">
                               {customer.phone || 'NO_PROXY'} — {customer.email || 'NO_CREDENTIAL'}
                             </p>
                           </div>
                        </div>
                        {selectedCustomer?.customerId === customer.customerId && (
                           <div className="h-2 w-2 rounded-full bg-gym-500 shadow-glow" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
               <div className="mb-6">
                  <h2 className="font-display text-xl font-bold text-white tracking-tight uppercase leading-tight">Identity Verification</h2>
                  <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest font-black opacity-60">Status Analysis</p>
               </div>

               {!selectedCustomer ? (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                   <div className="rounded-full bg-white/5 p-6 border border-white/5 mb-4">
                     <Search className="h-8 w-8 text-slate-700" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 leading-relaxed">Awaiting identity selection for<br/>access protocol verification.</p>
                 </div>
               ) : (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                   <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Subject Profile</p>
                      <p className="text-xl font-bold text-white font-display mb-1">{selectedCustomer.fullName}</p>
                      <p className="text-[11px] font-bold text-slate-400 opacity-60 uppercase">{selectedCustomer.phone || '-'}</p>
                   </div>

                   {selectedValidity && (
                     <div className={`rounded-2xl border p-5 ${selectedValidity.valid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
                       <div className="flex items-center gap-3 mb-3">
                          {selectedValidity.valid ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-rose-500" />}
                          <p className={`text-xs font-black uppercase tracking-widest ${selectedValidity.valid ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {selectedValidity.valid ? 'Grant Access' : 'Deny Access'}
                          </p>
                       </div>
                       <p className={`text-sm leading-relaxed ${selectedValidity.valid ? 'text-emerald-200/70' : 'text-rose-200/70'}`}>
                         {selectedValidity.valid ? 'Membership vector is active and verified for the current cycle.' : selectedValidity.reason}
                       </p>
                       
                       {selectedValidity.membership?.customerMembershipId && (
                         <div className="mt-4 border-t border-white/5 pt-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Contract Parameters</p>
                            <p className="text-sm font-bold text-white">{selectedValidity.membership.planName}</p>
                            <p className="text-xs text-slate-500 mt-1">
                               {selectedValidity.membership.startDate} — {selectedValidity.membership.endDate}
                            </p>
                         </div>
                       )}
                     </div>
                   )}

                   <button
                     type="button"
                     disabled={checkingIn}
                     onClick={() => performCheckin({ customerId: selectedCustomer.customerId })}
                     className="group relative h-16 w-full overflow-hidden rounded-2xl bg-gym-500 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-glow transition-all active:scale-95 disabled:opacity-10"
                   >
                     <span className="relative z-10">{checkingIn ? 'Initiating...' : 'Commit Access'}</span>
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" />
                   </button>
                 </div>
               )}
            </section>

            {successMessage && (
               <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-glow-sm animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-4">
                     <div className="rounded-full bg-emerald-500 p-2 text-slate-950">
                        <CheckCircle2 className="h-4 w-4" />
                     </div>
                     <div>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Protocol Success</p>
                        <p className="text-[13px] font-medium text-emerald-200/80 leading-relaxed mt-1">{successMessage}</p>
                     </div>
                  </div>
               </div>
            )}

            {errorMessage && (
               <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 shadow-22xl animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-4">
                     <div className="rounded-full bg-rose-500 p-2 text-white">
                        <AlertCircle className="h-4 w-4" />
                     </div>
                     <div>
                        <p className="text-xs font-black uppercase tracking-widest text-rose-400">Security Alert</p>
                        <p className="text-[13px] font-medium text-rose-200/80 leading-relaxed mt-1">{errorMessage}</p>
                     </div>
                  </div>
               </div>
            )}
          </aside>
        </div>

        <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gym-500/10 p-2.5 text-gym-500 ring-1 ring-gym-500/20">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Access Logs</h2>
                <p className="mt-0.5 text-sm text-slate-500">Historical synchronization of subject entries.</p>
              </div>
            </div>
            <button 
              onClick={refreshHistory}
              className="group rounded-xl bg-white/5 p-3 text-slate-500 border border-white/5 hover:text-white transition-all active:scale-95"
            >
              <Loader2 className={`h-4 w-4 ${loadingHistory ? 'animate-spin text-gym-500' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/5 bg-black/20">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-white/5 bg-white/[0.02]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Timestamp</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Subject</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Contract</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingHistory && history.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-700" />
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-600 italic">
                        No historical vectors established in current cycle.
                      </td>
                    </tr>
                  ) : (
                    history.map((item) => (
                      <tr key={item.checkInId} className="group transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-6 py-5 text-sm font-black text-white/40 group-hover:text-gym-500/60 tabular-nums">
                          {formatCheckinTimeVn(item.checkInTime)}
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-white">{item.fullName || '-'}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Verified Subject</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="inline-flex rounded-lg bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                            {item.planName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-medium text-slate-500 group-hover:text-slate-300">
                          {item.checkedByName || 'SYSTEM'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {scanPopup && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900 p-8 shadow-29xl ring-1 ring-white/10">
            <div className="absolute top-0 right-0 p-4">
               <button onClick={() => setScanPopup(null)} className="rounded-full bg-white/5 p-2 text-slate-500 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
               </button>
            </div>
            
            <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ${scanPopup.ok ? 'bg-emerald-500 text-slate-950 shadow-glow' : 'bg-rose-500 text-white shadow-2xl'}`}>
               {scanPopup.ok ? <CheckCircle2 className="h-10 w-10" /> : <AlertCircle className="h-10 w-10" />}
            </div>

            <div className="text-center">
              <h3 className={`font-display text-2xl font-bold uppercase tracking-tight ${scanPopup.ok ? 'text-white' : 'text-rose-400'}`}>
                {scanPopup.ok ? 'Protocol Finalized' : 'Detection Failure'}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 font-medium">
                {scanPopup.message}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScanPopup(null)}
                className="rounded-2xl border border-white/5 bg-white/5 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={async () => {
                  setScanPopup(null)
                  await openCamera()
                }}
                className="rounded-2xl bg-gym-500 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-950 shadow-glow transition-all active:scale-95"
              >
                Scan Next
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default ReceptionCheckinPage
