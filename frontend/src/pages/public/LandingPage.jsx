import { Link } from 'react-router-dom'
import { ArrowRight, Dumbbell, HeartPulse, ShieldCheck, Users } from 'lucide-react'

const programs = [
  {
    title: 'Strength Training',
    description: 'Structured muscle and power programs with coach guidance.',
    icon: Dumbbell,
  },
  {
    title: 'Cardio & HIIT',
    description: 'High-intensity sessions to improve stamina and fat loss.',
    icon: HeartPulse,
  },
  {
    title: 'Coach Booking',
    description: 'Book recurring PT schedules with matching and availability checks.',
    icon: Users,
  },
  {
    title: 'Progress Tracking',
    description: 'Track check-ins, health metrics, and workout consistency.',
    icon: ShieldCheck,
  },
]

const plans = [
  {
    title: 'Gym Only',
    price: '500,000 VND',
    detail: '30 days - full gym access',
  },
  {
    title: 'Day Pass',
    price: '80,000 VND',
    detail: '1 day - unlimited check-ins in that day',
  },
  {
    title: 'Gym + Coach',
    price: '5,000,000 VND',
    detail: '180 days - gym + coach booking access',
  },
]

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="inline-flex items-center gap-2">
            <span className="rounded-md bg-gym-500 p-1.5 text-white">
              <Dumbbell size={16} />
            </span>
            <span className="text-lg font-bold">GymCore</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth/login"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Login
            </Link>
            <Link
              to="/auth/register"
              className="rounded-lg bg-gym-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-900 px-4 py-20 text-white sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,167,115,0.35),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(14,167,115,0.2),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-gym-100">GymCore Platform</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Figma-based front-end frame ready for collaborative development
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            This starter includes auth, membership, coach booking, product sales, promotions, and admin workspaces
            mapped directly to project use-cases.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/customer/membership"
              className="inline-flex items-center gap-2 rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white transition hover:bg-gym-700"
            >
              Open Customer Workspace
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/admin/dashboard"
              className="rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Open Admin Workspace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold">Core Experience</h2>
        <p className="mt-2 text-sm text-slate-600">
          Starter cards below come from the Figma layout direction and can be split across teammates.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {programs.map((program) => {
            const Icon = program.icon
            return (
              <article key={program.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <Icon className="h-9 w-9 text-gym-700" />
                <h3 className="mt-4 text-lg font-semibold">{program.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{program.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
          {plans.map((plan) => (
            <article key={plan.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{plan.title}</h3>
              <p className="mt-3 text-2xl font-bold text-gym-700">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">{plan.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 text-sm text-slate-600 sm:flex-row sm:items-center">
          <p>GymCore collaborative frame - Spring Boot + React</p>
          <div className="flex items-center gap-4">
            <Link to="/customer/membership" className="hover:text-slate-900">
              Workspace
            </Link>
            <Link to="/auth/login" className="hover:text-slate-900">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
