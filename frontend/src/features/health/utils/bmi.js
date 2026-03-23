export function getBmiLevel(bmi) {
  if (bmi == null) {
    return {
      label: 'No data',
      textClass: 'text-slate-400',
      accent: '#94A3B8',
      summary: 'Add your latest body metrics',
      guidance: 'Enter height and weight to generate your BMI trend and healthy-weight target.',
      bgClass: 'bg-white/5',
      borderClass: 'border-white/10',
    }
  }

  if (bmi < 18.5) {
    return {
      label: 'Underweight',
      textClass: 'text-sky-400',
      accent: '#38BDF8',
      summary: 'Needs gain',
      guidance: 'You are below the normal BMI range. A gradual weight gain plan would move you toward the healthy zone.',
      bgClass: 'bg-sky-500/10',
      borderClass: 'border-sky-500/20',
    }
  }

  if (bmi < 25) {
    return {
      label: 'Normal',
      textClass: 'text-emerald-400',
      accent: '#34D399',
      summary: 'Healthy',
      guidance: 'Your BMI is inside the normal range. Maintain this zone with steady training and nutrition.',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/20',
    }
  }

  return {
    label: 'Overweight',
    textClass: 'text-rose-400',
    accent: '#FB7185',
    summary: 'Needs reduction',
    guidance: 'You are above the normal BMI range. Reducing body weight would move you back toward the healthy zone.',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/20',
  }
}

function parsePositiveNumber(value) {
  const parsed = Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export function calculateBmiResult(heightCm, weightKg) {
  const height = parsePositiveNumber(heightCm)
  const weight = parsePositiveNumber(weightKg)

  if (height == null || weight == null) {
    const level = getBmiLevel(null)
    return {
      ok: false,
      error: 'Invalid height or weight.',
      label: level.label,
      summary: level.summary,
      guidance: level.guidance,
      textClass: level.textClass,
      accent: level.accent,
    }
  }

  const heightMeters = height / 100
  const bmi = Number((weight / (heightMeters * heightMeters)).toFixed(1))
  const level = getBmiLevel(bmi)

  return {
    ok: true,
    bmi,
    label: level.label,
    summary: level.summary,
    guidance: level.guidance,
    textClass: level.textClass,
    accent: level.accent,
  }
}
