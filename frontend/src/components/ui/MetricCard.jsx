function MetricCard({ label, value, hint, icon, tone = 'neutral', valueLabel }) {
  return (
    <article className={`gc-metric-card gc-metric-card-${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="gc-metric-label">{label}</p>
          <div className="flex flex-wrap items-end gap-3">
            <h3 className="gc-metric-value">{value}</h3>
            {valueLabel ? <span className="gc-metric-value-label">{valueLabel}</span> : null}
          </div>
        </div>
        {icon ? <span className="gc-metric-icon">{icon}</span> : null}
      </div>
      {hint ? <p className="gc-metric-hint">{hint}</p> : null}
    </article>
  )
}

export default MetricCard


