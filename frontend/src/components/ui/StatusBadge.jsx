const toneClasses = {
  neutral: 'gc-status-badge gc-status-badge-neutral',
  success: 'gc-status-badge gc-status-badge-success',
  warning: 'gc-status-badge gc-status-badge-warning',
  danger: 'gc-status-badge gc-status-badge-danger',
  info: 'gc-status-badge gc-status-badge-info',
}

function StatusBadge({ tone = 'neutral', children, className = '' }) {
  const classes = toneClasses[tone] || toneClasses.neutral
  return <span className={`${classes} ${className}`.trim()}>{children}</span>
}

export default StatusBadge


