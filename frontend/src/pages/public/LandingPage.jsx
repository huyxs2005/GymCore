import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock3, Copy, Dumbbell, HeartPulse, MapPin, Phone, ShieldCheck, Users } from 'lucide-react'
import { useSession } from '../../features/auth/useSession'
import { roleLandingPath } from '../../features/auth/session'
import { gymPublicInfo } from '../../config/publicInfo'

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

const products = [
  {
    title: 'Whey Protein',
    price: 'from 900,000 VND',
    detail: 'Muscle recovery and daily protein support.',
  },
  {
    title: 'Creatine',
    price: 'from 350,000 VND',
    detail: 'Strength and performance support.',
  },
  {
    title: 'Mass Gainer',
    price: 'from 850,000 VND',
    detail: 'High-calorie formula for weight gain goals.',
  },
  {
    title: 'Pre-workout',
    price: 'from 580,000 VND',
    detail: 'Energy and focus support before training.',
  },
]

const faqs = [
  {
    question: 'How do I buy membership or products?',
    answer: 'Browse plans/products as guest, then login to complete purchase.',
  },
  {
    question: 'How does check-in work at the gym?',
    answer: 'You need an active membership (Day Pass, Gym Only, or Gym + Coach) to check in.',
  },
  {
    question: 'Can I book a coach directly?',
    answer: 'Coach booking is available only for customers with an active Gym + Coach membership.',
  },
]

function workspaceLabelByRole(role) {
  switch (role) {
    case 'CUSTOMER':
      return 'Customer Workspace'
    case 'COACH':
      return 'Coach Workspace'
    case 'RECEPTIONIST':
      return 'Reception Workspace'
    case 'ADMIN':
      return 'Admin Workspace'
    default:
      return 'Workspace'
  }
}

function LandingPage() {
  const { isAuthenticated, user } = useSession()
  const role = String(user?.role || '').toUpperCase()
  const workspacePath = roleLandingPath(role)
  const workspaceLabel = workspaceLabelByRole(role)
  const [hotlineCopied, setHotlineCopied] = useState(false)

  async function handleCopyHotline() {
    try {
      await navigator.clipboard.writeText(gymPublicInfo.hotline)
      setHotlineCopied(true)
      window.setTimeout(() => setHotlineCopied(false), 1500)
    } catch {
      setHotlineCopied(false)
    }
  }

  return (
    <div className="bg-white text-slate-900">
      <section className="relative overflow-hidden bg-slate-900 px-4 py-20 text-white sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,167,115,0.35),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(14,167,115,0.2),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-gym-100">GymCore Platform</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Train smarter, book coaches faster, and manage gym operations in one platform
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            Guests can explore memberships and products first. Login is required to purchase memberships/products,
            check in, and book coaches.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthenticated && workspacePath !== '/' ? (
              <Link
                to={workspacePath}
                className="inline-flex items-center gap-2 rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white transition hover:bg-gym-700"
              >
                Open {workspaceLabel}
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <a
                  href="#membership"
                  className="rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white transition hover:bg-gym-700"
                >
                  View Membership Plans
                </a>
                <a
                  href="#products"
                  className="rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-800"
                >
                  View Products
                </a>
                <Link
                  to="/auth/login"
                  className="rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-800"
                >
                  Login to Purchase
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-6">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
          <article className="gc-card-compact">
            <div className="inline-flex items-center gap-2 text-gym-700">
              <Clock3 size={16} />
              <span className="text-sm font-semibold">Opening Hours</span>
            </div>
            <p className="mt-2 text-base font-semibold text-slate-900">{gymPublicInfo.openingHours}</p>
          </article>
          <article className="gc-card-compact">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-gym-700">
                <Phone size={16} />
                <span className="text-sm font-semibold">Hotline</span>
              </div>
              <button
                type="button"
                onClick={handleCopyHotline}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                title="Copy hotline number"
                aria-label="Copy hotline number"
              >
                {hotlineCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <a className="mt-2 inline-block text-base font-semibold text-slate-900 hover:text-gym-700" href={`tel:${gymPublicInfo.hotline}`}>
              {gymPublicInfo.hotline}
            </a>
            {hotlineCopied && <p className="mt-1 text-xs font-medium text-gym-700">Copied</p>}
          </article>
          <article className="gc-card-compact">
            <div className="inline-flex items-center gap-2 text-gym-700">
              <MapPin size={16} />
              <span className="text-sm font-semibold">Address</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{gymPublicInfo.address}</p>
            <a
              className="mt-2 inline-flex text-sm font-semibold text-gym-700 hover:text-gym-900"
              href={gymPublicInfo.mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on map
            </a>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold">Core Experience</h2>
        <p className="mt-2 text-sm text-slate-600">Explore our main flows before signing in.</p>
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

      <section id="membership" className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-3 sm:px-6">
          {plans.map((plan) => (
            <article key={plan.title} className="gc-card">
              <h3 className="text-lg font-semibold">{plan.title}</h3>
              <p className="mt-3 text-2xl font-bold text-gym-700">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">{plan.detail}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
            Membership purchase requires login. Day Pass, Gym Only, and Gym + Coach plans are available.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-gym-100 px-3 py-1 text-xs font-semibold text-gym-900">
              Gym + Coach membership required for PT booking
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Login required before purchase
            </span>
          </div>
        </div>
      </section>

      <section id="products" className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold">Supplement Products</h2>
          <p className="mt-2 text-sm text-slate-600">
            Browse product categories as guest. Login is required to place orders. In-person pickup only.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <article key={product.title} className="gc-card">
                <h3 className="text-lg font-semibold">{product.title}</h3>
                <p className="mt-3 text-xl font-bold text-gym-700">{product.price}</p>
                <p className="mt-2 text-sm text-slate-600">{product.detail}</p>
                <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Pickup at gym only
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold">Quick FAQ</h2>
          <p className="mt-2 text-sm text-slate-600">Key info for first-time visitors.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {faqs.map((item) => (
              <article key={item.question} className="gc-card">
                <h3 className="text-base font-semibold">{item.question}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
