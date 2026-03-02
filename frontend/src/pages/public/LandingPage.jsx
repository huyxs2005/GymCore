import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  Heart,
  Zap,
  Users,
  Instagram,
  Twitter,
  Linkedin,
  Star
} from 'lucide-react'
import { useSession } from '../../features/auth/useSession'

const programs = [
  {
    title: 'Strength Training',
    description: 'Build muscle and increase your strength with our comprehensive weightlifting programs.',
    icon: Dumbbell,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
  },
  {
    title: 'Cardio Fitness',
    description: 'Improve your cardiovascular health with high-intensity interval training and endurance workouts.',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
  {
    title: 'HIIT Classes',
    description: 'Burn calories fast with our high-intensity interval training sessions led by expert coaches.',
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
  },
  {
    title: 'Group Training',
    description: 'Stay motivated with group fitness classes that make working out fun and social.',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
]

const trainers = [
  {
    name: 'Sarah Johnson',
    specialty: 'Strength & Conditioning',
    experience: '8+ years experience',
    image: 'https://images.unsplash.com/photo-1548690312-e3b507d17a4d?q=80&w=600&auto=format&fit=crop',
    socials: { ig: '#', tw: '#', li: '#' },
  },
  {
    name: 'Mike Thompson',
    specialty: 'CrossFit & HIIT',
    experience: '10+ years experience',
    image: 'https://images.unsplash.com/photo-1567013127542-490d757e51fe?q=80&w=600&auto=format&fit=crop',
    socials: { ig: '#', tw: '#', li: '#' },
  },
  {
    name: 'Emma Davis',
    specialty: 'Yoga & Pilates',
    experience: '6+ years experience',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=600&auto=format&fit=crop',
    socials: { ig: '#', tw: '#', li: '#' },
  },
]

const schedule = [
  { time: '6:00 AM', name: 'Morning Yoga', trainer: 'Emma Davis', spots: 10, status: 'open' },
  { time: '9:00 AM', name: 'CrossFit Basics', trainer: 'Mike Thompson', spots: 5, status: 'open' },
  { time: '12:00 PM', name: 'HIIT Training', trainer: 'Sarah Johnson', spots: 8, status: 'open' },
  { time: '6:00 PM', name: 'Strength Training', trainer: 'Sarah Johnson', spots: 0, status: 'full' },
]

const plans = [
  {
    title: 'Basic',
    subtitle: 'Perfect for beginners',
    price: '$29',
    features: ['Access to gym facilities', 'Locker room access', '2 group classes per week', 'Mobile app access'],
    popular: false,
  },
  {
    title: 'Pro',
    subtitle: 'Most popular choice',
    price: '$59',
    features: ['All Basic features', 'Unlimited group classes', '2 personal training sessions/month', 'Nutrition guidance', 'Priority booking'],
    popular: true,
  },
  {
    title: 'Elite',
    subtitle: 'For serious athletes',
    price: '$99',
    features: ['All Pro features', 'Unlimited personal training', 'Custom meal plans', 'Recovery & massage therapy', '24/7 gym access', 'Guest passes (2/month)'],
    popular: false,
  },
]

function LandingPage() {
  const { isAuthenticated } = useSession()
  const [activeDay, setActiveDay] = useState('Monday')

  useEffect(() => {
    const observerOptions = {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible')
        }
      })
    }, observerOptions)

    const sections = document.querySelectorAll('.reveal-section')
    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative h-[90vh] min-h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop"
            alt="Gym Background"
            className="w-full h-full object-cover brightness-[0.3]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="max-w-3xl space-y-8">
            <h1 className="text-6xl md:text-7xl font-black text-white leading-tight tracking-tight">
              Transform Your Body, <br />
              <span className="text-gym-500">Transform Your Life</span>
            </h1>
            <p className="text-xl text-gym-dark-100 max-w-2xl leading-relaxed font-medium">
              Join the ultimate fitness experience with expert trainers and state-of-the-art facilities.
              Everything you need to reach your goals.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/auth/register" className="btn-primary text-lg px-10 py-4 group">
                Start Free Trial
                <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
              </Link>
              <a href="#schedule" className="btn-outline-white text-lg px-10 py-4">
                View Classes
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="py-32 bg-white reveal-section reveal-hidden">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-4 mb-20">
            <span className="gc-section-kicker">Our Programs</span>
            <h2 className="text-5xl font-black text-gym-dark-900 tracking-tight">Choose Your Path</h2>
            <p className="text-xl text-gym-dark-400 font-medium">
              Variety of fitness programs designed to help you reach your specific goals.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {programs.map((p, idx) => {
              const Icon = p.icon
              return (
                <div key={p.title} className="gc-card text-left group stagger-item" style={{ '--stagger-idx': idx }}>
                  <div className={`${p.bgColor} ${p.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110`}>
                    <Icon size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-gym-dark-900 mb-4">{p.title}</h3>
                  <p className="text-gym-dark-400 font-bold leading-relaxed">{p.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trainers Section */}
      <section id="trainers" className="py-32 bg-gym-dark-50 reveal-section reveal-hidden">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-4 mb-20">
            <span className="gc-section-kicker text-gym-500">Meet Our Trainers</span>
            <h2 className="text-5xl font-black text-gym-dark-900 tracking-tight">Work With The Best</h2>
            <p className="text-xl text-gym-dark-400 font-medium">
              Certified professionals who are passionate about helping you succeed.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {trainers.map((t, idx) => (
              <div key={t.name} className="bg-white rounded-[40px] overflow-hidden shadow-xl border border-gym-dark-100 group stagger-item" style={{ '--stagger-idx': idx }}>
                <div className="relative h-[400px] overflow-hidden">
                  <img src={t.image} alt={t.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="p-8 text-left">
                  <h3 className="text-2xl font-black text-gym-dark-900 mb-1">{t.name}</h3>
                  <p className="text-gym-500 font-bold text-sm uppercase tracking-wider mb-2">{t.specialty}</p>
                  <p className="text-gym-dark-300 font-bold text-sm mb-6">{t.experience}</p>
                  <div className="flex gap-4">
                    <button className="text-gym-dark-300 hover:text-gym-500 transition-colors"><Instagram size={20} /></button>
                    <button className="text-gym-dark-300 hover:text-gym-500 transition-colors"><Twitter size={20} /></button>
                    <button className="text-gym-dark-300 hover:text-gym-500 transition-colors"><Linkedin size={20} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section id="schedule" className="py-32 bg-white reveal-section reveal-hidden">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-4 mb-16">
            <span className="gc-section-kicker text-gym-500">Class Schedule</span>
            <h2 className="text-5xl font-black text-gym-dark-900 tracking-tight">Plan Your Week</h2>
            <p className="text-xl text-gym-dark-400 font-medium">
              Book your spot in our popular fitness classes.
            </p>
          </div>

          {/* Day Tabs */}
          <div className="flex justify-center mb-12">
            <div className="bg-gym-dark-50 p-2 rounded-2xl flex gap-2">
              {['Monday', 'Wednesday', 'Friday'].map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${activeDay === day ? 'bg-white text-gym-dark-900 shadow-md scale-105' : 'text-gym-dark-400 hover:text-gym-dark-900'
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-5xl mx-auto space-y-4" key={activeDay}>
            {schedule.map((item, idx) => (
              <div key={idx} className="gc-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-gym-500/50 animate-[revealUp_0.4s_ease-out_forwards]" style={{ animationDelay: `${idx * 0.1}s`, opacity: 0 }}>
                <div className="flex items-center gap-8 w-full md:w-auto">
                  <div className="flex items-center gap-3 text-gym-500">
                    <Clock3 size={24} />
                    <span className="text-2xl font-black">{item.time}</span>
                  </div>
                  <div className="text-left">
                    <h4 className="text-2xl font-black text-gym-dark-900">{item.name}</h4>
                    <p className="text-gym-dark-400 font-bold">with {item.trainer}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                  <div className="flex items-center gap-2">
                    {item.status === 'open' ? (
                      <>
                        <Users className="text-gym-500" size={20} />
                        <span className="text-gym-500 font-black">{item.spots} spots left</span>
                      </>
                    ) : (
                      <>
                        <Users className="text-red-500" size={20} />
                        <span className="text-red-500 font-black">Full Capacity</span>
                      </>
                    )}
                  </div>
                  <Link
                    to={isAuthenticated ? "/customer/coach-booking" : "/auth/login"}
                    className={`px-10 py-3 rounded-xl font-black transition-all ${item.status === 'open'
                      ? 'bg-gym-500 text-white hover:bg-gym-600 shadow-lg shadow-gym-500/25'
                      : 'bg-gym-dark-100 text-gym-dark-400 cursor-not-allowed'
                      }`}
                  >
                    {item.status === 'open' ? 'Book Now' : 'Full'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-gym-dark-50 reveal-section reveal-hidden">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-4 mb-20">
            <span className="gc-section-kicker text-gym-500">Membership Plans</span>
            <h2 className="text-5xl font-black text-gym-dark-900 tracking-tight">Join The Community</h2>
            <p className="text-xl text-gym-dark-400 font-medium">
              Choose the perfect plan to achieve your fitness goals.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {plans.map((plan, idx) => (
              <div
                key={plan.title}
                className={`relative gc-card flex flex-col p-12 transition-all duration-500 stagger-item ${plan.popular ? 'border-gym-500 ring-2 ring-gym-500/20 scale-105 z-10' : ''
                  }`}
                style={{ '--stagger-idx': idx }}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gym-500 text-white text-xs font-black uppercase tracking-widest px-6 py-2 rounded-full shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-10">
                  <h3 className="text-3xl font-black text-gym-dark-900 mb-2">{plan.title}</h3>
                  <p className="text-gym-dark-400 font-bold">{plan.subtitle}</p>
                </div>
                <div className="mb-10 flex items-end justify-center gap-1">
                  <span className="text-5xl font-black text-gym-dark-900">{plan.price}</span>
                  <span className="text-gym-dark-400 font-black mb-1">/month</span>
                </div>
                <ul className="text-left space-y-4 mb-12 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex gap-3 text-gym-dark-700 font-bold">
                      <Check className="text-gym-500 shrink-0" size={20} strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={isAuthenticated ? "/customer/membership" : "/auth/login"}
                  className={`w-full py-4 rounded-xl font-black transition-all ${plan.popular
                    ? 'bg-gym-500 text-white hover:bg-gym-600 shadow-xl shadow-gym-500/40'
                    : 'border-2 border-gym-dark-100 text-gym-dark-900 hover:bg-gym-dark-50'
                    }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-32 bg-gym-dark-900 overflow-hidden relative reveal-section reveal-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-gym-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-gym-500/10 rounded-full blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tight">
            Ready To Start Your <span className="text-gym-500 underline decoration-8 decoration-gym-500/20 underline-offset-8">Transformation?</span>
          </h2>
          <p className="text-xl text-gym-dark-400 mb-12 max-w-2xl mx-auto font-bold">
            Join thousands of others who have already reached their fitness goals with GymCore.
          </p>
          <Link to="/auth/register" className="btn-primary py-5 px-16 text-xl shadow-2xl">
            Join GymCore Today
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LandingPage

