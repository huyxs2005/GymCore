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
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Change password</h1>
      <p className="mt-2 text-sm text-slate-600">Starter page for authenticated password change flow.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Current password</span>
          <input
            type="password"
            name="oldPassword"
            value={form.oldPassword}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">New password</span>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button type="submit" className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700">
          Update password
        </button>
      </form>
    </div>
  )
}

export default ChangePasswordPage
