function PageSection({
  kicker,
  title,
  description,
  actions = null,
  children,
  className = '',
  contentClassName = '',
}) {
  return (
    <section className={`gc-page-section ${className}`.trim()}>
      {(kicker || title || description || actions) ? (
        <header className="gc-page-section-header">
          <div className="space-y-3">
            {kicker ? <p className="gc-page-kicker">{kicker}</p> : null}
            {title ? <h2 className="gc-page-section-title">{title}</h2> : null}
            {description ? <p className="gc-page-section-copy">{description}</p> : null}
          </div>
          {actions ? <div className="gc-page-section-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  )
}

export default PageSection


