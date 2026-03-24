function getPreferredLocale(locale) {
  if (locale) return locale
  if (typeof navigator !== 'undefined') {
    const first = Array.isArray(navigator.languages) ? navigator.languages[0] : navigator.language
    if (first) return first
  }
  return 'en-US'
}

export function formatCurrency(value, currency = 'VND', locale) {
  const normalized = Number(value || 0)
  return new Intl.NumberFormat(getPreferredLocale(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(normalized)
}

export function formatCompactNumber(value, locale) {
  return new Intl.NumberFormat(getPreferredLocale(locale), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))
}

export function formatInteger(value, locale) {
  return new Intl.NumberFormat(getPreferredLocale(locale), {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export function formatDateTime(value, locale, options = {}) {
  if (!value) return '--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(getPreferredLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date)
}

export function formatDate(value, locale, options = {}) {
  if (!value) return '--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(getPreferredLocale(locale), {
    dateStyle: 'medium',
    ...options,
  }).format(date)
}


