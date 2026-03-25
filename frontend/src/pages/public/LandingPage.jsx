import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock3, Copy, MapPin, Phone, ShoppingBag, X } from 'lucide-react'
import { gymPublicInfo } from '../../config/publicInfo'

const storyPoints = [
  {
    title: 'Choose the kind of training experience that fits you',
    description:
      'Whether you want a flexible day pass, a steady solo routine, or guided support with a coach, GymCore helps you choose clearly and start with confidence.',
  },
  {
    title: 'See what the gym offers before you commit',
    description:
      'Explore memberships, supplements, and training guidance first, then sign in when you are ready to buy, check in, or manage your routine.',
  },
  {
    title: 'Stay consistent with tools that support real progress',
    description:
      'Track your gym access, follow your membership, explore fitness guidance, and move toward a routine that feels easier to maintain long term.',
  },
]

const membershipComparison = [
  {
    label: 'Day Pass',
    title: 'Quick access for a focused training day',
    items: [
      { kind: 'yes', text: 'Unlimited gym check-ins for one day' },
      { kind: 'yes', text: 'Lowest-commitment option to try the gym' },
      { kind: 'no', text: 'No month-based membership duration' },
      { kind: 'no', text: 'No coach-booking eligibility' },
    ],
  },
  {
    label: 'Gym Only',
    title: 'Consistent full-gym access for self-guided training',
    items: [
      { kind: 'yes', text: 'Full gym access for the paid membership period' },
      { kind: 'yes', text: 'Best for independent training routines' },
      { kind: 'yes', text: 'Stronger fit for long-term consistency' },
      { kind: 'no', text: 'No coach-booking eligibility' },
    ],
  },
  {
    label: 'Gym + Coach',
    title: 'Structured support with coach-booking access',
    items: [
      { kind: 'yes', text: 'Full gym access for the paid membership period' },
      { kind: 'yes', text: 'Unlocks eligibility to request recurring PT support' },
      { kind: 'yes', text: 'Best for members who want coaching guidance' },
      { kind: 'yes', text: 'Built for structure, accountability, and progress' },
    ],
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
    question: 'Do I need an account before I can explore the gym website?',
    answer:
      'No. You can browse memberships, supplements, promotions, and training content first. You only need to sign in when you want to purchase, check in, or manage your member activity.',
  },
  {
    question: 'Which membership should I choose?',
    answer:
      'Day Pass is best for a single training day, Gym Only is the standard option for independent training, and Gym + Coach is the plan that unlocks coach-booking eligibility and more structured support.',
  },
  {
    question: 'How does check-in work when I arrive at the gym?',
    answer:
      'Check-in uses your active membership status. Day Pass, Gym Only, and Gym + Coach can all be used for gym entry, but the membership must still be active and valid for that day.',
  },
  {
    question: 'Can I book a coach with any membership?',
    answer:
      'No. Coach booking is reserved for customers with an active Gym + Coach membership. That plan is designed for members who want recurring PT support instead of self-guided training only.',
  },
  {
    question: 'How do supplement orders work?',
    answer:
      'Products are paid online after sign-in, then collected in person at the gym. This keeps pickup fast and verified while letting you browse the shop before creating an account.',
  },
  {
    question: 'Can I use promotions on the website?',
    answer:
      'Yes. Promotions are shown on the site and can support either membership offers or product-order discounts, depending on the campaign that is currently active.',
  },
]

function LandingPage() {
  const [hotlineCopied, setHotlineCopied] = useState(false)
  const heroVideoRef = useRef(null)

  useEffect(() => {
    if (!heroVideoRef.current) {
      return
    }

    heroVideoRef.current.playbackRate = 0.75
  }, [])

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
      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white sm:px-6 sm:py-20">
        <div className="absolute inset-0 overflow-hidden">
          <video
            ref={heroVideoRef}
            className="h-full w-full object-cover blur-[3px] brightness-[0.42]"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          >
            <source src="/media/landing-hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,158,11,0.18),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(22,163,74,0.12),transparent_24%),linear-gradient(135deg,rgba(9,9,15,0.82)_0%,rgba(17,24,39,0.78)_48%,rgba(15,23,42,0.86)_100%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="flex min-h-[560px] items-end py-6 sm:min-h-[620px]">
            <div className="w-full max-w-6xl py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gym-100">Atmospheric Fitness Workspace</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[0.98] sm:text-5xl lg:text-7xl">
                Your fitness journey starts here.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-200 sm:text-lg">
                High-energy training spaces, expert coaching support, and a smoother member experience from first visit to long-term routine.
              </p>
              <div className="mt-10 grid w-full max-w-none gap-12 border-t border-white/15 pt-7 text-base leading-8 text-slate-200 sm:grid-cols-3 lg:grid-cols-[1.08fr_0.98fr_1.12fr] lg:text-lg lg:leading-9">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gym-100">Train</p>
                  <p className="mt-3 max-w-none">
                    Step into a gym environment built for strength, consistency, and everyday progress instead of one-off motivation.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gym-100">Recover</p>
                  <p className="mt-3 max-w-none">
                    Get support from coaches, structured member tools, and supplements that fit real training goals and routines.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gym-100">Belong</p>
                  <p className="mt-3 max-w-none">
                    Join a space that feels active, disciplined, and welcoming from your first visit to your long-term fitness journey.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-6">
        <div className="mx-auto grid max-w-7xl gap-0 px-4 sm:grid-cols-3 sm:px-6">
          <article className="border-b border-slate-200 py-4 sm:border-b-0 sm:border-r sm:pr-6">
            <div className="inline-flex items-center gap-2 text-gym-700">
              <Clock3 size={16} />
              <span className="text-sm font-semibold">Opening Hours</span>
            </div>
            <p className="mt-2 text-base font-semibold text-slate-900">{gymPublicInfo.openingHours}</p>
          </article>
          <article className="border-b border-slate-200 py-4 sm:border-b-0 sm:border-r sm:px-6">
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
            <p className="mt-2 text-base font-semibold text-slate-900">
              {gymPublicInfo.hotline}
            </p>
          </article>
          <article className="py-4 sm:pl-6">
            <div className="inline-flex items-center gap-2 text-gym-700">
              <MapPin size={16} />
              <span className="text-sm font-semibold">Address</span>
            </div>
            <a
              className="mt-2 inline-flex text-base font-semibold leading-6 text-slate-900 transition duration-200 hover:!text-emerald-400"
              href={gymPublicInfo.mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              {gymPublicInfo.address}
            </a>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-stretch xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="grid min-h-full py-2 lg:grid-rows-[1fr_auto]">
            <div className="flex flex-col justify-center">
              <p className="text-base font-semibold uppercase tracking-[0.28em] text-gym-700 lg:text-lg">Why GymCore</p>
              <div className="mt-4 max-w-2xl">
                <h2 className="text-4xl font-bold leading-[1.08] lg:text-5xl">
                  GymCore helps you start strong, train consistently, and choose the support that fits your goals.
                </h2>
              </div>
            </div>
            <div className="mt-8 space-y-6 lg:mt-0">
              {storyPoints.map((item) => (
                <div key={item.title} className="border-l-2 border-gym-500 pl-5">
                  <h3 className="text-xl font-semibold leading-8 text-slate-50 lg:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-8 text-slate-200 lg:text-lg lg:leading-9">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-h-full gap-6 lg:grid-rows-[1fr_auto]">
            <article className="group relative overflow-hidden">
              <img
                src="/media/landing/gym-room.jpg"
                alt="Gym room interior"
                className="block h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.75)]">Gym Room</p>
                <p className="mt-2 max-w-xl text-xl font-semibold text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.75)] sm:text-2xl">
                  Built for everyday training, not just first impressions.
                </p>
              </div>
            </article>

            <div className="grid gap-6 sm:grid-cols-[0.8fr_1.2fr]">
              <article className="group relative overflow-hidden">
                <img
                  src="/media/landing/qr-checkin.jpg"
                  alt="QR check-in"
                  className="block h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.75)]">QR Access</p>
                  <p className="mt-2 max-w-xs text-base font-semibold leading-7 text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.75)]">
                    Fast check-in with a clean member entry flow.
                  </p>
                </div>
              </article>

              <article className="group relative overflow-hidden">
                <img
                  src="/media/landing/coach-discuss.jpg"
                  alt="Coach discussing goals with customer"
                  className="block h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.75)]">Coach Discuss</p>
                  <p className="mt-2 max-w-sm text-base font-semibold leading-7 text-white drop-shadow-[0_8px_24px_rgba(15,23,42,0.75)]">
                    Coaching support that feels personal, practical, and goal-driven.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="membership" className="border-t border-white/10 py-16">
        <div className="mx-auto grid max-w-[1600px] gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[0.98fr_1.02fr]">
          <div className="flex flex-col">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gym-700">Membership</p>
            <h2 className="mt-4 text-3xl font-bold">Choose access based on how you actually train</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
              Day Pass is the easiest way to start. Gym Only is built for independent training, while Gym + Coach opens the personal-training request flow for members who want structured support.
            </p>
            <div className="mt-8 space-y-5">
              {plans.map((plan) => (
                <div key={plan.title} className="border-b border-slate-200 pb-5 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h3 className="text-xl font-semibold text-slate-900">{plan.title}</h3>
                    <p className="text-lg font-bold text-gym-700">{plan.price}</p>
                  </div>
                  <p className="mt-2 text-base text-slate-300">{plan.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm font-semibold text-gym-700">
              Gym + Coach membership required for PT booking
            </p>
            <div className="mt-10">
              <Link
                to="/customer/membership"
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-gym-600 via-gym-400 to-gym-600 bg-[length:200%_auto] px-8 py-4 text-[15px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_32px_-8px_rgba(14,167,115,0.6)] transition-all duration-500 hover:-translate-y-1 hover:bg-[100%_center] hover:shadow-[0_12px_40px_-8px_rgba(14,167,115,0.8)]"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <span className="relative z-10 flex items-center gap-2.5 drop-shadow-md">
                  <ShoppingBag size={18} strokeWidth={2.5} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                  <span>Buy now</span>
                  <ArrowRight size={18} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-rows-[auto_1fr]">
            <div className="group relative overflow-hidden">
              <img
                src="/media/landing/membership-consultation.png"
                alt="Gym membership consultation"
                className="block h-[360px] w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
            </div>

            <div>
              <div className="grid gap-8 sm:grid-cols-3 sm:gap-8 xl:gap-10">
                {membershipComparison.map((step) => (
                  <div key={step.label} className="flex h-full flex-col space-y-3">
                    <p className="text-base font-black tracking-[0.12em] text-gym-700">{step.label}</p>
                    <h3 className="min-h-[160px] text-[2rem] font-semibold leading-[1.2] text-slate-50">
                      {step.title}
                    </h3>
                    <div className="space-y-3 pt-1">
                      {step.items.map((item) => (
                        <div key={`${step.label}-${item.text}`} className="flex items-start gap-3">
                          <span
                            className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              item.kind === 'yes'
                                ? 'bg-emerald-500/18 text-emerald-400'
                                : 'bg-rose-500/18 text-rose-400'
                            }`}
                          >
                            {item.kind === 'yes' ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                          </span>
                          <p className="text-base leading-8 text-slate-200">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="border-t border-white/10 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="group relative overflow-hidden">
            <img
              src="/media/landing/creatin.jpg"
              alt="Creatine supplement"
              className="block h-auto w-full transition duration-500 group-hover:scale-[1.01]"
            />
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gym-700">Supplement Products</p>
            <h2 className="mt-4 text-3xl font-bold">Support training goals with essential gym supplements</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Guests can browse supplement categories before login, then place orders after signing in. All purchases are collected at the gym so pickup stays fast, verified, and easy to manage.
            </p>
            <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {products.map((product) => (
                <div key={product.title} className="border-t border-slate-200 pt-4">
                  <h3 className="text-lg font-semibold text-slate-900">{product.title}</h3>
                  <p className="mt-2 text-base font-bold text-gym-700">{product.price}</p>
                  <p className="mt-2 text-sm text-slate-600">{product.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/customer/shop"
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-gym-600 via-gym-400 to-gym-600 bg-[length:200%_auto] px-8 py-4 text-[15px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_32px_-8px_rgba(14,167,115,0.6)] transition-all duration-500 hover:-translate-y-1 hover:bg-[100%_center] hover:shadow-[0_12px_40px_-8px_rgba(14,167,115,0.8)]"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <span className="relative z-10 flex items-center gap-2.5 drop-shadow-md">
                  <ShoppingBag size={18} strokeWidth={2.5} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                  <span>Buy now</span>
                  <ArrowRight size={18} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
              <p className="text-sm font-semibold text-gym-700">Pickup at gym only</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="max-w-xl">
              <p className="text-lg font-black uppercase tracking-[0.26em] text-gym-700 sm:text-xl">FAQ</p>
              <h2 className="mt-4 text-3xl font-bold text-slate-950 sm:text-4xl">Questions customers usually ask before they join</h2>
              <p className="mt-4 text-base leading-8 text-slate-700">
                If you are comparing memberships, wondering how check-in works, or deciding whether Gym + Coach is worth it, start here.
              </p>
            </div>
            <div className="space-y-4">
              {faqs.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] transition open:border-gym-200 open:shadow-[0_24px_60px_rgba(34,197,94,0.08)] sm:px-6"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                    <span className="text-lg font-semibold leading-8 text-slate-950">{item.question}</span>
                    <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 transition group-open:bg-gym-100 group-open:text-gym-800">
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <p className="mt-4 pr-12 text-base leading-8 text-slate-700">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
