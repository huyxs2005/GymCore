import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
      <p className="mt-2 text-sm text-slate-600">Starter page for view/edit profile use-case.</p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {profileQuery.isLoading && <p className="text-sm text-slate-600">Loading profile...</p>}
        {profileQuery.isError && <p className="text-sm text-rose-700">Failed to load profile.</p>}
        {viewUser ? (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="sm:w-56">
              <div className="flex items-center gap-4 sm:flex-col sm:items-start">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-900 text-xl font-bold text-white">
                    {(viewUser?.fullName || viewUser?.email || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-base font-semibold text-slate-900">{viewUser?.fullName}</p>
                  <p className="text-sm text-slate-600">{viewUser?.email}</p>
                  <p className="mt-1 text-xs text-slate-500">Role: {viewUser?.role}</p>
                </div>
              </div>

              <div className="mt-3">
                <Link
                  to="/auth/change-password"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Change password
                </Link>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Change profile photo</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={isUploading}
                  onChange={handleAvatarChange}
                  className="mt-2 block w-full text-sm"
                />
                {uploadError ? <p className="mt-2 text-sm text-rose-700">{uploadError}</p> : null}
                {isUploading ? <p className="mt-2 text-xs text-slate-500">Uploading...</p> : null}
              </div>
            </div>

            <div className="flex-1">
              <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700">Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                </label>

                <label className={`block text-sm ${canEditDemographics ? '' : 'sm:col-span-2'}`.trim()}>
                  <span className="mb-1 block font-medium text-slate-700">Phone</span>
                  <input
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
                    maxLength={16}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  {phoneError ? <p className="mt-1 text-xs text-rose-700">{phoneError}</p> : null}
                </label>

                {canEditDemographics ? (
                  <>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Date of birth</span>
                      <input
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(e) => setForm((s) => ({ ...s, dateOfBirth: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">Gender</span>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  </>
                ) : null}

                <div className="sm:col-span-2">
                  {saveError ? <p className="text-sm text-rose-700">{saveError}</p> : null}
                  {saveSuccess ? <p className="text-sm text-gym-700">{saveSuccess}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-gym-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>

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
