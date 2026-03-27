import { useEffect, useMemo, useRef, useState } from 'react'
import { QrCode, Search, History, CheckCircle2, AlertCircle, UserRound, X, ShieldAlert, Loader2 } from 'lucide-react'
import QrScanner from 'qr-scanner'
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

function formatDateRangeVn(startDate, endDate) {
  const formatDate = (value) => {
    if (!value) return ''
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return String(value)

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(parsed)
  }

  const start = formatDate(startDate)
  const end = formatDate(endDate)
  if (!start && !end) return ''
  if (!start) return end
  if (!end) return start
  return `${start} - ${end}`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ACCESS_LOGS_PAGE_SIZE = 10

function ReceptionCheckinPage() {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedValidity, setSelectedValidity] = useState(null)
  const [searching, setSearching] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [scanPopup, setScanPopup] = useState(null)
  const [scanPopupCountdown, setScanPopupCountdown] = useState(5)

  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const handlingScanRef = useRef(false)
  const suppressNextSearchRef = useRef(false)
  const manualSectionRef = useRef(null)

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
    setHistoryPage(1)
  }, [history.length])

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false
      return undefined
    }

    if (!trimmedQuery) {
      setCustomers([])
      setSearching(false)
      setSelectedCustomer(null)
      setSelectedValidity(null)
      return undefined
    }

    const timer = window.setTimeout(() => {
      runSearch(trimmedQuery)
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  useEffect(() => {
    if (!cameraSupported) {
      return
    }

    const timer = window.setTimeout(() => {
      if (!cameraOpen && !cameraReady && !cameraError) {
        openCamera()
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [cameraSupported])

  useEffect(() => {
    if (!scanPopup) {
      return undefined
    }

    setScanPopupCountdown(5)

    const interval = window.setInterval(() => {
      setScanPopupCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          setScanPopup(null)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [scanPopup])

  useEffect(() => {
    if (scanPopup || cameraOpen || checkingIn || !cameraSupported) {
      return
    }

    const timer = window.setTimeout(() => {
      if (!cameraOpen && !checkingIn) {
        openCamera()
      }
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [scanPopup, cameraOpen, checkingIn, cameraSupported])

  function scrollToCustomerPanels() {
    const target = manualSectionRef.current
    if (!target) {
      return
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function stopCamera() {
    const scanner = scannerRef.current
    if (scanner) {
      scanner.stop()
      scanner.destroy()
      scannerRef.current = null
    }

    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
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

  async function enhanceCameraTrack(track) {
    if (!track || typeof track.getCapabilities !== 'function' || typeof track.applyConstraints !== 'function') {
      return
    }

    const capabilities = track.getCapabilities()
    const advanced = []

    if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' })
    }

    if (typeof capabilities.zoom?.max === 'number' && typeof capabilities.zoom?.min === 'number') {
      const preferredZoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, 2))
      if (preferredZoom > capabilities.zoom.min) {
        advanced.push({ zoom: preferredZoom })
      }
    }

    if (advanced.length === 0) {
      return
    }

    try {
      await track.applyConstraints({ advanced })
    } catch {
      // Best-effort enhancement only.
    }
  }

  async function performCheckin(payload) {
    setCheckingIn(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await receptionCheckinApi.scan(payload)
      const data = response?.data || {}
      const formattedTime = formatCheckinTimeVn(data?.checkInTime)
      const membershipName = data?.membership?.planName ? ` with ${data.membership.planName}` : ''
      const successText = `Checked in ${data?.customer?.fullName || 'customer'}${membershipName} at ${formattedTime}.`
      setSuccessMessage(successText)
      const checkedInCustomerId = data?.customer?.customerId || payload?.customerId || selectedCustomer?.customerId
      if (checkedInCustomerId) {
        await loadMembershipValidity(checkedInCustomerId)
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
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await receptionCheckinApi.validateMembershipByQrToken(token)
      const data = response?.data || {}
      const customer = data?.customer || null

      if (data?.valid && customer?.customerId) {
        setSelectedCustomer(null)
        setSelectedValidity(null)
        setCustomers([])
        suppressNextSearchRef.current = true
        setQuery('')
        const result = await performCheckin({ customerId: customer.customerId })
        const popupMessage = result.ok
          ? `Successful check-in. ${customer.fullName} used ${data?.membership?.planName || 'their active membership'}.`
          : result.message
        setScanPopup({
          ok: result.ok,
          message: popupMessage,
          highlight: data?.membership?.planName || '',
        })
      } else {
        if (customer?.customerId) {
          setSelectedCustomer(customer)
          setSelectedValidity(data)
          setCustomers([customer])
          suppressNextSearchRef.current = true
          setQuery(customer.fullName || customer.email || customer.phone || '')
          scrollToCustomerPanels()
        } else {
          setSelectedCustomer(null)
          setSelectedValidity(null)
          setCustomers([])
        }
        const membershipName = data?.membership?.planName ? `${data.membership.planName}. ` : ''
        const message = membershipName + (data?.reason || 'Membership is not valid for check-in.')
        setErrorMessage(message)
        setScanPopup({
          ok: false,
          message,
        })
      }
    } catch (error) {
      const message = resolveApiMessage(error, 'QR code is invalid or customer was not found.')
      setSelectedCustomer(null)
      setSelectedValidity(null)
      setCustomers([])
      setErrorMessage(message)
      setScanPopup({
        ok: false,
        message,
      })
    }
    handlingScanRef.current = false
  }

  async function openCamera() {
    if (!cameraSupported) {
      setCameraError('Camera is not supported in this browser.')
      return
    }

    stopCamera()
    setCameraError('')
    try {
      const video = videoRef.current
      if (!video) {
        return
      }

      const scanner = new QrScanner(
        video,
        (result) => {
          handleQrTokenDetected(result?.data || '')
        },
        {
          onDecodeError: () => {},
          preferredCamera: 'environment',
          maxScansPerSecond: 30,
          calculateScanRegion: (videoElement) => {
            const width = videoElement.videoWidth || 1280
            const height = videoElement.videoHeight || 720
            return {
              x: 0,
              y: 0,
              width,
              height,
              downScaledWidth: Math.min(width, 1280),
              downScaledHeight: Math.min(height, 720),
            }
          },
          returnDetailedScanResult: true,
        },
      )
      scanner.setInversionMode('both')
      scannerRef.current = scanner
      await scanner.start()

      const stream = video.srcObject
      const [videoTrack] = stream instanceof MediaStream ? stream.getVideoTracks() : []
      await enhanceCameraTrack(videoTrack)

      setCameraOpen(true)
      setCameraReady(true)
    } catch {
      stopCamera()
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

  async function runSearch(searchTerm = query.trim()) {
    const trimmedQuery = searchTerm.trim()
    if (!trimmedQuery) {
      setCustomers([])
      setSearching(false)
      return
    }

    setSearching(true)
    setErrorMessage('')
    setSuccessMessage('')
    setSelectedCustomer(null)
    setSelectedValidity(null)
    try {
      const response = await receptionCustomerApi.searchCustomers(trimmedQuery)
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

  const membershipDateRange = formatDateRangeVn(selectedValidity?.membership?.startDate, selectedValidity?.membership?.endDate)
  const popupHighlightPattern = scanPopup?.highlight ? new RegExp(`(${escapeRegExp(scanPopup.highlight)})`) : null
  const popupMessageParts = popupHighlightPattern ? String(scanPopup?.message || '').split(popupHighlightPattern) : [scanPopup?.message || '']
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / ACCESS_LOGS_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages)
  const paginatedHistory = history.slice(
    (safeHistoryPage - 1) * ACCESS_LOGS_PAGE_SIZE,
    safeHistoryPage * ACCESS_LOGS_PAGE_SIZE,
  )

  return (
    <WorkspaceScaffold
      showHeader={false}
      links={receptionNav}
    >
      <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid items-stretch gap-8 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="order-2 flex flex-col">
            <div ref={manualSectionRef} />
            <section className="gc-glass-panel flex h-full min-h-[25rem] flex-col border-white/5 bg-white/[0.02] p-8">
              <div className="mb-8 items-start justify-between sm:flex">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Manual check-in</h2>
                </div>
              </div>

              <div className="group relative">
                <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:ring-gym-500/50 focus-within:bg-white/5">
                  <div className="pl-4 text-slate-500 group-focus-within:text-gym-500">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Enter customer's name, email or phone number"
                    className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex-1 space-y-3">
                {searching ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/[0.01]" />
                    ))}
                  </div>
                ) : customers.length === 0 && query ? (
                   <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-12 text-center">
                     <p className="text-xs font-black uppercase tracking-widest text-slate-600">Customer not found</p>
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
                             <UserRound className="h-5 w-5" />
                           </div>
                           <div>
                             <p className="font-display text-lg font-bold text-white tracking-tight">{customer.fullName}</p>
                             <p className="text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-400">
                               {customer.phone ? `${customer.phone} - ` : ""}{customer.email || 'NO_CREDENTIAL'}
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

          <aside className="order-3 flex flex-col">
             <section className="gc-glass-panel flex h-full min-h-[25rem] flex-col border-white/5 bg-white/[0.02] p-8">
               <div className="mb-6">
                  <h2 className="font-display text-xl font-bold text-white tracking-tight uppercase leading-tight">Customer information</h2>
               </div>

               {!selectedCustomer ? (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                   <div className="rounded-full bg-white/5 p-6 border border-white/5 mb-4">
                     <Search className="h-8 w-8 text-slate-700" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 leading-relaxed">Waiting for customer&apos;s information.</p>
                 </div>
               ) : (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                   <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Name</p>
                      <p className="mt-2 text-xl font-bold text-white font-display">{selectedCustomer.fullName}</p>
                      {selectedCustomer.phone ? (
                        <>
                          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Phone number</p>
                          <p className="mt-2 text-[11px] font-bold text-slate-400 opacity-80 uppercase">{selectedCustomer.phone}</p>
                        </>
                      ) : null}
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
                         {selectedValidity.valid
                           ? `${selectedValidity.membership?.planName || 'Membership'} is active and valid for check-in today.`
                           : selectedValidity.reason}
                       </p>
                       
                       {selectedValidity.membership?.customerMembershipId && (
                         <div className="mt-4 border-t border-white/5 pt-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Membership plan</p>
                            <p className="text-sm font-bold text-white">{selectedValidity.membership.planName}</p>
                            {membershipDateRange ? (
                              <p className="mt-1 text-xs text-slate-500">{membershipDateRange}</p>
                            ) : null}
                         </div>
                       )}
                     </div>
                   )}

                   <button
                     type="button"
                     disabled={checkingIn || !selectedCustomer || !selectedValidity?.valid}
                     onClick={() => performCheckin({ customerId: selectedCustomer.customerId })}
                     className="group relative h-16 w-full overflow-hidden rounded-2xl bg-gym-500 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-glow transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
                   >
                     <span className="relative z-10">{checkingIn ? 'Initiating...' : 'Commit Access'}</span>
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" />
                   </button>
                 </div>
               )}
            </section>
          </aside>

          <div className="order-1 space-y-8 xl:col-span-2">
            <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">QR check in</h2>
                </div>
              </div>

              <div className="relative h-[34rem] w-full">
                <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-gym-500/20 via-transparent to-gym-500/10 blur-2xl opacity-50" />
                <div className="relative h-full w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 ring-1 ring-white/5">
                  <video ref={videoRef} className="h-full w-full object-cover opacity-60 mix-blend-screen" muted playsInline />
                  
                  {!cameraReady && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                      <div className="rounded-full bg-white/5 p-6 border border-white/5">
                        <QrCode className="h-12 w-12 text-slate-700" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Camera offline</p>
                    </div>
                  )}

                  {cameraReady && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-72 w-72">
                        <div className="absolute inset-0 border-2 border-gym-500/40 rounded-3xl" />
                        <div className="absolute -inset-1 border-2 border-gym-500/20 rounded-[2rem] animate-pulse" />
                        <div className="absolute top-0 left-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-gym-500" />
                        <div className="absolute top-0 right-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-gym-500" />
                        <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-gym-500" />
                        <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-gym-500" />
                        <div className="absolute top-0 left-4 right-4 h-1 bg-gym-500 shadow-glow animate-scan" />
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <ShieldAlert className="mb-4 h-10 w-10 text-rose-500" />
                      <p className="text-sm font-bold uppercase tracking-tight text-rose-400">System Access Denied</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{cameraError}</p>
                    </div>
                  )}
                </div>
              </div>

              {cameraOpen && (
                <div className="mt-8 flex justify-center">
                  <div className="flex items-center gap-3 rounded-full bg-emerald-500/10 px-4 py-2 ring-1 ring-emerald-500/20">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-glow" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">QR scanning</span>
                  </div>
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
          </div>
        </div>

        <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gym-500/10 p-2.5 text-gym-500 ring-1 ring-gym-500/20">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Access Logs</h2>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/5 bg-black/20">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-white/5 bg-white/[0.02]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white">Timestamp</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white">Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white">Membership plan</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white">Employee</th>
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
                    paginatedHistory.map((item) => (
                      <tr key={item.checkInId} className="group transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-6 py-5 text-sm font-black text-white tabular-nums">
                          {formatCheckinTimeVn(item.checkInTime)}
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-white">{item.fullName || '-'}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="inline-flex rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                            {item.planName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-medium text-white">
                          {item.checkedByName || 'SYSTEM'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {history.length > ACCESS_LOGS_PAGE_SIZE ? (
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                disabled={safeHistoryPage === 1}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Prev
              </button>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                {safeHistoryPage} / {totalHistoryPages}
              </div>
              <button
                type="button"
                onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))}
                disabled={safeHistoryPage === totalHistoryPages}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {scanPopup && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={() => setScanPopup(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900 p-8 shadow-29xl ring-1 ring-white/10"
            onClick={(event) => event.stopPropagation()}
          >
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
                {scanPopup.ok ? 'Check-in successful' : 'Detection Failure'}
              </h3>
              <p className={`mt-3 text-sm leading-relaxed font-medium ${scanPopup.ok ? 'text-white' : 'text-slate-400'}`}>
                {popupMessageParts.map((part, index) => (
                  part === scanPopup?.highlight ? (
                    <span key={`${part}-${index}`} className="text-emerald-400">
                      {part}
                    </span>
                  ) : (
                    <span key={`${part}-${index}`}>{part}</span>
                  )
                ))}
              </p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Closes automatically in {scanPopupCountdown}s
              </p>
            </div>

          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default ReceptionCheckinPage
