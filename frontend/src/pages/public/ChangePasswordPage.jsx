import { useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'

function ChangePasswordPage() {
  const [form, setForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  function handleChange(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setErrorMessage('')
      setMessage('')
      await authApi.changePassword(form)
      setMessage('Password updated successfully.')
      setForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Could not change password.')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gym-dark-900 tracking-tight mb-4">Change Password</h1>
        <p className="text-gym-dark-400 font-bold text-lg">Update your password to keep your account secure</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 gc-card p-10">
        <div className="space-y-2">
          <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Current Password</span>
          <input
            type="password"
            name="oldPassword"
            value={form.oldPassword}
            onChange={handleChange}
            className="gc-input"
            placeholder="••••••••"
            required
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">New Password</span>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            className="gc-input"
            placeholder="••••••••"
            required
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Confirm New Password</span>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            className="gc-input"
            placeholder="••••••••"
            required
          />
        </div>
        {errorMessage ? <p className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">{errorMessage}</p> : null}
        {message ? <p className="text-sm font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100">{message}</p> : null}
        <button type="submit" className="btn-primary w-full py-4 text-lg">
          Update Password
        </button>
      </form>
    </div>
  )
}

export default ChangePasswordPage
