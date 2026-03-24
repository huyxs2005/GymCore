import { Link } from 'react-router-dom'

function AuthPageShell({
  kicker,
  title,
  description,
  children,
  asideTitle = 'Built for routines that feel calm, focused, and repeatable',
  asideCopy = 'GymCore keeps memberships, coaching, product pickup, and daily progress inside one atmospheric workspace that stays readable late into the night.',
  asideItems = [],
  footer = null,
}) {
  return (
    <section className="gc-auth-shell">
      <div className="gc-auth-shell-grid">
        <aside className="gc-auth-aside">
          <Link to="/" className="gc-auth-brand">
            <span className="gc-auth-brand-mark">GC</span>
            <span className="gc-auth-brand-copy">
              <span className="gc-auth-brand-title">GymCore</span>
              <span className="gc-auth-brand-subtitle">Atmospheric Minimalist Workspace</span>
            </span>
          </Link>

          <div className="space-y-5">
            <p className="gc-page-kicker">Member Access</p>
            <h2 className="gc-auth-aside-title">{asideTitle}</h2>
            <p className="gc-auth-aside-copy">{asideCopy}</p>
          </div>

          {asideItems.length > 0 ? (
            <ul className="gc-auth-aside-list">
              {asideItems.map((item) => (
                <li key={item} className="gc-auth-aside-list-item">{item}</li>
              ))}
            </ul>
          ) : null}
        </aside>

        <div className="gc-auth-panel">
          <header className="space-y-3">
            {kicker ? <p className="gc-page-kicker">{kicker}</p> : null}
            <h1 className="gc-auth-title">{title}</h1>
            {description ? <p className="gc-auth-copy">{description}</p> : null}
          </header>

          <div className="gc-auth-card">
            {children}
          </div>

          {footer ? <div className="gc-auth-footer">{footer}</div> : null}
        </div>
      </div>
    </section>
  )
}

export default AuthPageShell


