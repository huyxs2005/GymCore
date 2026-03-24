import { useState } from 'react'
import AuthPageShell from '../../components/auth/AuthPageShell'
import FormField from '../../components/ui/FormField'
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
      setErrorMessage(error?.response?.data?.message || 'Could not change password. Check the current password and try again.')
    }
  }

  return (
    <AuthPageShell
      kicker="Account Security"
      title="Rotate your password without leaving the authenticated flow."
      description="Use this page after login to replace the current password with a new one."
      asideItems={[
        'Password policy matches registration and reset.',
        'Current password is required before a new one is accepted.',
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField id="change-old-password" label="Current password" required>
          <input id="change-old-password" type="password" name="oldPassword" autoComplete="current-password" value={form.oldPassword} onChange={handleChange} className="gc-input" required />
        </FormField>
        <FormField id="change-new-password" label="New password" required>
          <input id="change-new-password" type="password" name="newPassword" autoComplete="new-password" value={form.newPassword} onChange={handleChange} className="gc-input" required />
        </FormField>
        <FormField id="change-confirm-password" label="Confirm password" required>
          <input id="change-confirm-password" type="password" name="confirmPassword" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} className="gc-input" required />
        </FormField>
        {errorMessage ? <div role="alert" className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">{errorMessage}</div> : null}
        {message ? <div aria-live="polite" className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">{message}</div> : null}
        <button type="submit" className="gc-button-primary w-full">Update Password</button>
      </form>
    </AuthPageShell>
  )
}

export default ChangePasswordPage


