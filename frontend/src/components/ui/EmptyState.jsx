function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  className = '',
}) {
  return (
    <div className={`gc-empty-state ${className}`.trim()}>
      {icon ? <div className="gc-empty-state-icon">{icon}</div> : null}
      <div className="space-y-2">
        <h3 className="gc-empty-state-title">{title}</h3>
        {description ? <p className="gc-empty-state-copy">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export default EmptyState


