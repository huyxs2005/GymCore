import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock3, Copy, MapPin, Phone, ShoppingBag, Sparkles } from 'lucide-react'
import { gymPublicInfo } from '../../config/publicInfo'

const storyPoints = [
  {
    title: 'Memberships built around how people actually train',
    description: 'Day Pass, Gym Only, and Gym + Coach each map to a real operational rule set instead of vague package marketing.',
  },
  {
    title: 'Product checkout stays online, pickup stays at the gym',
    description: 'Customers browse, pay via PayOS, then collect products at the front desk with invoice and pickup tracking behind the scenes.',
  },
  {
    title: 'PT booking uses recurring day and slot logic',
    description: 'Coach matching follows the same rules as the real booking flow, including partial matches, approvals, cancellations, and reschedules.',
  },
]

const plans = [
  {
    title: 'Day Pass',
    price: '80,000 VND',
    detail: 'Single-day gym access with unlimited check-ins that day.',
  },
  {
    title: 'Gym Only',
    price: '500,000 VND',
    detail: 'Self-guided membership for customers who train independently.',
  },
  {
    title: 'Gym + Coach',
    price: '5,000,000 VND',
    detail: 'Includes coach-booking eligibility for structured support.',
  },
]

const products = [
  { title: 'Whey Protein', detail: 'Recovery and daily protein support for training blocks.' },
  { title: 'Creatine', detail: 'Simple performance support for strength and repeat effort.' },
  { title: 'Mass Gainer', detail: 'High-calorie option for customers focusing on weight gain.' },
  { title: 'Pre-workout', detail: 'Energy and focus support before hard sessions.' },
]

const faqs = [
  {
    question: 'Do I need an account before exploring the website?',
    answer: 'No. Guests can browse memberships, products, promotions, and workout or food content before signing in.',
  },
  {
    question: 'Which membership unlocks coach booking?',
    answer: 'Only Gym + Coach can unlock PT booking. Day Pass and Gym Only do not allow coach-booking eligibility.',
  },
  {
    question: 'How do product orders work?',
    answer: 'Orders are paid online, then picked up in person at the gym front desk. Delivery is intentionally out of scope.',
  },
]

function LandingPage() {
  const [hotlineCopied, setHotlineCopied] = useState(false)
  const heroVideoRef = useRef(null)

  useEffect(() => {
    if (!heroVideoRef.current) return
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
    <div className="space-y-20 pb-24 lg:space-y-24">
      <section className="gc-shell-boundary pt-8 sm:pt-10 lg:pt-12">
        <div className="gc-panel relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gym-500/10 blur-[120px]" />
          <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-gym-500/10 blur-[120px]" />
          <div className="absolute inset-0 overflow-hidden">
            <video
              ref={heroVideoRef}
              className="h-full w-full object-cover opacity-20 blur-[2px]"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            >
              <source src="/media/landing-hero.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(245,158,11,0.1),transparent_18%),linear-gradient(135deg,rgba(18,18,26,0.88),rgba(10,10,15,0.72)_48%,rgba(10,10,15,0.94))]" />
          </div>

          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:items-end">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/15 bg-amber-500/10 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
                <span className="h-2 w-2 rounded-full bg-gym-400 animate-pulse" aria-hidden="true" />
                Minimalist Dark System
              </div>
              <div className="space-y-5">
                <h1 className="gc-page-title max-w-4xl">
                  Your fitness journey starts here.
                </h1>
                <p className="gc-page-copy max-w-3xl text-base sm:text-lg">
                  Step into a gym environment built for strength, structure, and a full operational flow from membership to PT booking, product pickup, and progress follow-up.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to="/auth/register" className="gc-button-primary">
                  Start with an account
                  <ArrowRight size={16} />
                </Link>
                <Link to="/auth/login" className="gc-button-secondary">
                  Enter the workspace
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {storyPoints.map((item) => (
                  <article key={item.title} className="gc-panel-soft h-full px-4 py-5">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-amber-200">{item.title}</p>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">{item.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="gc-panel-soft p-5">
                <p className="gc-page-kicker">Live At A Glance</p>
                <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-300">
                  <p className="flex items-start gap-3"><Sparkles size={16} className="mt-1 text-gym-300" /><span>Membership checkout, product checkout, and coupon application follow business rules from the same backend model.</span></p>
                  <p className="flex items-start gap-3"><Sparkles size={16} className="mt-1 text-gym-300" /><span>Reception supports QR or manual customer lookup for check-in and pickup workflows.</span></p>
                  <p className="flex items-start gap-3"><Sparkles size={16} className="mt-1 text-gym-300" /><span>Coach booking, customer health, and notifications stay role-aware instead of acting like isolated pages.</span></p>
                </div>
              </div>

              <div className="gc-panel-soft p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-zinc-500">Hotline</p>
                    <p className="mt-2 text-lg font-bold text-white">{gymPublicInfo.hotline}</p>
                  </div>
                  <button type="button" onClick={handleCopyHotline} className="gc-button-icon" aria-label="Copy hotline number">
                    {hotlineCopied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm text-zinc-400">
                  <p className="inline-flex items-center gap-2"><Clock3 size={14} className="text-gym-400" />Open Daily: {gymPublicInfo.openingHours}</p>
                  <a href={gymPublicInfo.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 transition-[color] duration-200 hover:text-white">
                    <MapPin size={14} className="mt-1 text-gym-400" />
                    <span>{gymPublicInfo.address}</span>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="gc-shell-boundary">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="gc-page-section">
            <p className="gc-page-kicker">Membership Logic</p>
            <h2 className="gc-page-section-title">Choose the plan that matches the rule set you actually need.</h2>
            <p className="gc-page-section-copy">
              Day Pass is for one-day access, Gym Only is for independent training, and Gym + Coach is the only path that unlocks PT booking eligibility.
            </p>
            <div className="grid gap-4">
              {plans.map((plan) => (
                <article key={plan.title} className="gc-panel-soft px-5 py-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h3 className="font-display text-2xl font-bold text-white">{plan.title}</h3>
                    <p className="font-mono text-base font-bold text-amber-300">{plan.price}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{plan.detail}</p>
                </article>
              ))}
            </div>
            <Link to="/customer/membership" className="gc-button-primary inline-flex w-fit">
              Explore memberships
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <article className="gc-panel-soft overflow-hidden">
              <img
                src="/media/landing/gym-room.jpg"
                alt="Gym room interior"
                width="1200"
                height="900"
                className="aspect-[4/3] w-full object-cover"
                fetchPriority="high"
              />
              <div className="p-5">
                <p className="gc-page-kicker">Gym Floor</p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">Built for repeatable daily training, not just first impressions.</p>
              </div>
            </article>
            <article className="gc-panel-soft overflow-hidden">
              <img
                src="/media/landing/coach-discuss.jpg"
                alt="Coach discussing goals with customer"
                width="1200"
                height="900"
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
              <div className="p-5">
                <p className="gc-page-kicker">Coach Support</p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">Recurring PT support, approvals, session notes, and rating flows all live inside the same model.</p>
              </div>
            </article>
            <article className="gc-panel-soft overflow-hidden sm:col-span-2">
              <img
                src="/media/landing/qr-checkin.jpg"
                alt="QR check-in at the gym"
                width="1600"
                height="900"
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
              />
              <div className="p-5">
                <p className="gc-page-kicker">Reception Workflow</p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">Check-in and product pickup stay front-desk friendly, with QR scanning, manual fallback search, invoice status, and membership validity checks.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="gc-shell-boundary">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr]">
          <div className="gc-page-section">
            <p className="gc-page-kicker">Supplement Shop</p>
            <h2 className="gc-page-section-title">Browse products online. Pay online. Pick up in person.</h2>
            <p className="gc-page-section-copy">
              Product sales are intentionally scoped to gym operations: cart, coupon, PayOS checkout, invoice history, and in-person pickup instead of delivery logistics.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((product) => (
                <article key={product.title} className="gc-panel-soft px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-xl font-bold text-white">{product.title}</h3>
                    <ShoppingBag size={18} className="text-amber-300" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{product.detail}</p>
                </article>
              ))}
            </div>
            <Link to="/customer/shop" className="gc-button-secondary inline-flex w-fit">
              Open product shop
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="gc-page-section">
            <p className="gc-page-kicker">FAQ</p>
            <h2 className="gc-page-section-title">Answer the common workflow questions before customers hit friction.</h2>
            <div className="space-y-4">
              {faqs.map((item) => (
                <details key={item.question} className="gc-panel-soft px-5 py-4">
                  <summary className="cursor-pointer list-none text-base font-bold text-white">{item.question}</summary>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{item.answer}</p>
                </details>
              ))}
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5 shadow-[0_0_30px_rgba(245,158,11,0.06)]">
              <p className="gc-page-kicker">Need Direct Help?</p>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                <p className="inline-flex items-center gap-2"><Phone size={14} className="text-gym-400" />{gymPublicInfo.hotline}</p>
                <p className="inline-flex items-center gap-2"><Clock3 size={14} className="text-gym-400" />{gymPublicInfo.openingHours}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage


