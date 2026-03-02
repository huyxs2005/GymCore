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
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-gym-dark-900 tracking-tight mb-2">My Profile</h1>
        <p className="text-gym-dark-400 font-bold">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Left Column: Avatar & Quick Actions */}
        <aside className="lg:col-span-1 space-y-6">
          <section className="gc-card p-8 flex flex-col items-center text-center">
            <div className="relative group mb-6">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-40 w-40 rounded-full border-4 border-white shadow-xl object-cover ring-2 ring-gym-500/20"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="grid h-40 w-40 place-items-center rounded-full bg-gym-dark-900 text-5xl font-black text-white shadow-xl ring-2 ring-gym-500/20">
                  {(viewUser?.fullName || viewUser?.email || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <label className="absolute bottom-2 right-2 h-10 w-10 bg-gym-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gym-600 transition-colors shadow-lg border-2 border-white">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={isUploading}
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <span className="text-xl">+</span>
              </label>
            </div>

            <h2 className="text-2xl font-black text-gym-dark-900 break-all">{viewUser?.fullName}</h2>
            <p className="text-gym-dark-400 font-bold mb-4">{viewUser?.email}</p>
            <span className="inline-block px-4 py-1 bg-gym-50 text-gym-500 rounded-full text-xs font-black uppercase tracking-widest border border-gym-100 mb-6">
              {viewUser?.role}
            </span>

            <div className="w-full pt-6 border-t border-gym-dark-50">
              <Link
                to="/auth/change-password"
                className="btn-outline-white w-full py-3"
              >
                Change Password
              </Link>
            </div>

            {uploadError && <p className="mt-4 text-sm font-bold text-red-600 bg-red-50 p-3 rounded-xl w-full">{uploadError}</p>}
            {isUploading && <p className="mt-4 text-xs font-black text-gym-500 animate-pulse">Uploading new avatar...</p>}
          </section>
        </aside>

        {/* Right Column: Profile Form */}
        <main className="lg:col-span-2">
          <section className="gc-card p-10">
            <h3 className="text-xl font-black text-gym-dark-900 mb-8 border-b border-gym-dark-50 pb-4">Personal Information</h3>

            {profileQuery.isLoading ? (
              <div className="py-12 text-center">
                <p className="text-gym-dark-400 font-bold animate-pulse">Loading profile data...</p>
              </div>
            ) : profileQuery.isError ? (
              <div className="py-12 text-center text-red-600 bg-red-50 rounded-2xl border border-red-100">
                <p className="font-bold">Failed to load profile settings.</p>
              </div>
            ) : viewUser ? (
              <form onSubmit={handleSaveProfile} className="space-y-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Full Name</span>
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                      className="gc-input"
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Phone Number</span>
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          phone: sanitizePhoneInput(e.target.value),
                        }))
                      }
                      type="tel"
                      className="gc-input"
                      placeholder="+84..."
                    />
                    {phoneError && <p className="text-xs font-bold text-red-600">{phoneError}</p>}
                  </div>

                  {canEditDemographics && (
                    <>
                      <div className="space-y-2">
                        <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Date of Birth</span>
                        <input
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => setForm((s) => ({ ...s, dateOfBirth: e.target.value }))}
                          className="gc-input"
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Gender</span>
                        <select
                          value={form.gender}
                          onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
                          className="gc-input"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-6 border-t border-gym-dark-50">
                  {saveError && <p className="mb-4 text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">{saveError}</p>}
                  {saveSuccess && <p className="mb-4 text-sm font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100">{saveSuccess}</p>}

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary px-10 py-4"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Profile Settings'}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </main>
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
