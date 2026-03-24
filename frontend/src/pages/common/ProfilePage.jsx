import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Camera, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { authApi } from '../../features/auth/api/authApi'
import { apiClient } from '../../api/client'
import { setAuthUser } from '../../features/auth/session'
import { useSession } from '../../features/auth/useSession'
import AvatarCropDialog from '../../components/profile/AvatarCropDialog'

const PHONE_REGEX = /^\+?[0-9]{8,15}$/

function sanitizePhoneInput(value) {
  if (!value) return ''
  let trimmed = String(value).trim()
  if (!trimmed) return ''

  // NFKC converts "fullwidth" digits and symbols (common on some keyboards/IME) into ASCII.
  // Example: "０９０" -> "090"
  try {
    trimmed = trimmed.normalize('NFKC')
  } catch {
    // Ignore if normalize is unavailable in the runtime.
  }

  const hasPlus = trimmed.startsWith('+')
  const digitsOnly = trimmed.replace(/[^\d]/g, '')
  if (!digitsOnly) return hasPlus ? '+' : ''
  return hasPlus ? `+${digitsOnly}` : digitsOnly
}

function getRoleBadge(role) {
  const normalized = String(role || '').toUpperCase()

  if (normalized === 'ADMIN') {
    return {
      label: 'Admin control access',
      className: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    }
  }

  if (normalized === 'RECEPTIONIST') {
    return {
      label: 'Reception desk access',
      className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    }
  }

  if (normalized === 'COACH') {
    return {
      label: 'Coach workspace profile',
      className: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    }
  }

  return {
    label: 'Customer account profile',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  }
}

function ProfilePage() {
  const { user: cachedUser } = useSession()
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
  })

  const profileUser = profileQuery.data?.data?.user || null
  const viewUser = profileUser || cachedUser || null

  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const canEditDemographics = useMemo(() => {
    const role = (viewUser?.role || '').toUpperCase()
    return role === 'CUSTOMER' || role === 'COACH'
  }, [viewUser?.role])

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
  })

  const phoneError = useMemo(() => {
    if (!form.phone) return ''
    if (PHONE_REGEX.test(form.phone)) return ''
    return 'Phone number is invalid (use only digits, optional leading +, length 8-15).'
  }, [form.phone])

  useEffect(() => {
    if (!viewUser) return
    setForm({
      fullName: viewUser.fullName || '',
      phone: viewUser.phone || '',
      dateOfBirth: viewUser.dateOfBirth || '',
      gender: viewUser.gender || '',
    })
  }, [viewUser])

  const avatarUrl = useMemo(() => {
    const raw = viewUser?.avatarUrl || ''
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    return raw
  }, [viewUser?.avatarUrl])
  const roleBadge = useMemo(() => getRoleBadge(viewUser?.role), [viewUser?.role])

  function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadError('')
    setPendingAvatarFile(file)
    setCropOpen(true)
    event.target.value = ''
  }

  async function uploadCroppedAvatar(file) {
    try {
      setUploadError('')
      setIsUploading(true)
      const form = new FormData()
      form.append('file', file)
      const response = await apiClient.post('/v1/auth/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const nextUser = response?.data?.data?.user
      if (nextUser) {
        setAuthUser(nextUser)
      }

      await profileQuery.refetch()
      setCropOpen(false)
      setPendingAvatarFile(null)
    } catch (error) {
      const message = error?.response?.data?.message || 'Upload avatar failed.'
      setUploadError(message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault()
    try {
      if (phoneError) {
        setSaveSuccess('')
        setSaveError(phoneError)
        return
      }

      setSaveError('')
      setSaveSuccess('')
      setIsSaving(true)
      const response = await authApi.updateProfile({
        fullName: form.fullName,
        phone: form.phone || null,
        dateOfBirth: canEditDemographics ? form.dateOfBirth || null : null,
        gender: canEditDemographics ? form.gender || null : null,
      })

      const nextUser = response?.data?.user
      if (nextUser) {
        setAuthUser(nextUser)
      }

      setSaveSuccess('Profile updated.')
      await profileQuery.refetch()
    } catch (error) {
      const message = error?.response?.data?.message || 'Update profile failed.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="gc-panel overflow-hidden">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)] lg:px-8 lg:py-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="gc-page-kicker">Account workspace</span>
                <span className={`gc-status-badge ${roleBadge.className}`}>{roleBadge.label}</span>
              </div>
              <div>
                <h1 className="gc-page-title text-[clamp(2.4rem,4vw,4.3rem)]">My Profile</h1>
                <p className="mt-3 max-w-2xl text-base leading-8 text-zinc-400">
                  Keep identity, contact details, and account recovery surfaces aligned in one place without drifting away
                  from the rest of the GymCore workspace.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Account email</p>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-100">{viewUser?.email || 'No email yet'}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Editable profile</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{canEditDemographics ? 'Full profile' : 'Core identity only'}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Security path</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">Password and photo controls stay separate</p>
                </div>
              </div>
            </div>

            <div className="gc-panel-soft relative overflow-hidden px-5 py-5">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.18),_transparent_70%)] blur-3xl" />
              <div className="relative flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      width="80"
                      height="80"
                      loading="lazy"
                      className="h-20 w-20 rounded-full border border-white/10 object-cover shadow-[0_14px_32px_rgba(0,0,0,0.28)]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_40%),linear-gradient(180deg,_rgba(26,26,36,0.96),_rgba(18,18,26,0.94))] text-xl font-black text-white shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
                      {(viewUser?.fullName || viewUser?.email || 'U').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-slate-50">{viewUser?.fullName || 'Unnamed member'}</p>
                    <p className="mt-1 truncate text-sm text-slate-400">{viewUser?.email || 'No email set'}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gym-400" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Primary email</p>
                        <p className="truncate text-sm text-slate-200">{viewUser?.email || 'No email set'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-gym-400" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Access role</p>
                        <p className="text-sm text-slate-200">{String(viewUser?.role || 'Member').toLowerCase()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to="/auth/change-password" className="gc-button-secondary">
                    Change password
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.84fr)_minmax(0,1.16fr)]">
          <aside className="gc-panel-soft space-y-5 p-6">
            <div>
              <p className="gc-page-kicker">Identity media</p>
              <h2 className="mt-2 font-display text-[1.85rem] font-black tracking-tight text-white">Photo and presence</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Keep your avatar recognizable across dashboards, notifications, and coaching workflows.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <label className="block text-sm font-medium text-slate-200">Change profile photo</label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  id="profile-avatar-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={isUploading}
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
                <label
                  htmlFor="profile-avatar-upload"
                  className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                    isUploading
                      ? 'cursor-not-allowed border-white/10 bg-white/10 text-slate-400'
                      : 'border-gym-500/20 bg-gym-500/10 text-gym-200 hover:border-gym-400 hover:bg-gym-500/15'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  {isUploading ? 'Uploading…' : 'Choose image'}
                </label>
                <span className="text-xs leading-6 text-slate-500">PNG, JPG, or WebP. Square images work best.</span>
              </div>
              {uploadError ? <p aria-live="polite" className="mt-3 text-sm text-rose-400">{uploadError}</p> : null}
              {isUploading ? <p aria-live="polite" className="mt-3 text-xs text-slate-500">Uploading…</p> : null}
            </div>

            <div className="grid gap-3">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="gc-metric-icon h-10 w-10 rounded-2xl">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Visible name</p>
                    <p className="text-sm font-semibold text-slate-100">{form.fullName || 'Set your full name'}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="gc-metric-icon h-10 w-10 rounded-2xl">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Reachability</p>
                    <p className="text-sm font-semibold text-slate-100">{form.phone || 'Add a phone number if needed'}</p>
                  </div>
                </div>
              </div>
              {canEditDemographics ? (
                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="gc-metric-icon h-10 w-10 rounded-2xl">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Demographics</p>
                      <p className="text-sm font-semibold text-slate-100">Date of birth and gender are editable for your role.</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="gc-panel p-6 sm:p-8">
            {profileQuery.isLoading ? <p aria-live="polite" className="text-sm text-slate-400">Loading profile…</p> : null}
            {profileQuery.isError ? <p className="text-sm text-rose-400">Failed to load profile.</p> : null}
            {viewUser ? (
              <form onSubmit={handleSaveProfile} className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="gc-page-kicker">Editable fields</p>
                  <h2 className="mt-2 font-display text-[1.95rem] font-black tracking-tight text-white">Refine your account details</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                    Keep labels clear, validation visible, and contact data reliable so the same profile works well across customer,
                    coach, reception, and admin surfaces.
                  </p>
                </div>

                <label className="gc-field sm:col-span-2">
                  <span className="gc-field-label">
                    Full name
                    <span className="gc-field-required">Required</span>
                  </span>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                    className="gc-input"
                    autoComplete="name"
                    required
                  />
                </label>

                <label className={`gc-field ${canEditDemographics ? '' : 'sm:col-span-2'}`.trim()}>
                  <span className="gc-field-label">
                    Phone
                    <span className="gc-field-required">Optional</span>
                  </span>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        phone: sanitizePhoneInput(e.target.value),
                      }))
                    }
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    spellCheck={false}
                    maxLength={40}
                    className="gc-input"
                    placeholder="+84905675437"
                  />
                  <p className="gc-field-hint">Use digits only, with an optional leading + for international numbers.</p>
                  {phoneError ? <p className="gc-field-error">{phoneError}</p> : null}
                </label>

                {canEditDemographics ? (
                  <>
                    <label className="gc-field">
                      <span className="gc-field-label">Date of birth</span>
                      <input
                        name="dateOfBirth"
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(e) => setForm((s) => ({ ...s, dateOfBirth: e.target.value }))}
                        className="gc-input"
                        autoComplete="bday"
                      />
                    </label>

                    <label className="gc-field">
                      <span className="gc-field-label">Gender</span>
                      <select
                        name="gender"
                        value={form.gender}
                        onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
                        className="gc-select"
                        autoComplete="sex"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  </>
                ) : null}

                <div className="sm:col-span-2 grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-1 h-4 w-4 text-gym-400" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Sign-in email</p>
                      <p className="mt-1 text-sm text-slate-200">{viewUser?.email || 'No email available'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-1 h-4 w-4 text-gym-400" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Role scope</p>
                      <p className="mt-1 text-sm text-slate-200">
                        {canEditDemographics ? 'You can update demographics here.' : 'This role uses core identity fields only.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  {saveError ? <p aria-live="polite" className="text-sm text-rose-400">{saveError}</p> : null}
                  {saveSuccess ? <p aria-live="polite" className="text-sm text-gym-300">{saveSuccess}</p> : null}
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={isSaving} className="gc-button-primary">
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </button>
                  <p className="text-xs leading-6 text-slate-500">
                    Changes update your local session and refetch the latest profile payload after save.
                  </p>
                </div>
              </form>
            ) : null}
          </section>
        </section>
      </div>

      <AvatarCropDialog
        open={cropOpen}
        file={pendingAvatarFile}
        onClose={() => {
          if (isUploading) return
          setCropOpen(false)
          setPendingAvatarFile(null)
        }}
        onConfirm={uploadCroppedAvatar}
      />
    </div>
  )
}

export default ProfilePage



