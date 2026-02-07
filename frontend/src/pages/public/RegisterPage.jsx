import { Link } from 'react-router-dom'
import { useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'

function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
  })

  function handleChange(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await authApi.register(form)
    alert('Register API wired. Continue with validation and success flow.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
      <p className="mt-2 text-sm text-slate-600">Starter form for guest registration use-case.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Full name</span>
          <input
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Phone</span>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <button type="submit" className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700">
          Register
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-semibold text-gym-700 hover:underline">
          Login
        </Link>
      </p>
    </div>
  )
}

export default RegisterPage
