function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children,
}) {
  return (
    <div className={`gc-field ${className}`.trim()}>
      {label ? (
        <label htmlFor={id} className="gc-field-label">
          <span>{label}</span>
          {required ? <span className="gc-field-required" aria-hidden="true">Required</span> : null}
        </label>
      ) : null}
      {hint ? <p className="gc-field-hint">{hint}</p> : null}
      {children}
      {error ? <p className="gc-field-error" role="alert">{error}</p> : null}
    </div>
  )
}

export default FormField


