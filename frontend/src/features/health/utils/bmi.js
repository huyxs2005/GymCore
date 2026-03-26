export function getBmiLevel(bmi) {
  if (bmi == null) {
    return {
      label: 'No data',
      textClass: 'text-slate-400',
      accent: '#94A3B8',
      summary: 'Add your latest body metrics',
      guidance: 'Add your latest height and weight to unlock a clearer starting point for your fitness journey.',
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
      guidance: 'You have room to build more strength and body mass. Stay consistent with training, recovery, and nutrition to move toward a stronger baseline.',
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
      guidance: 'You are in a strong healthy zone. Keep the momentum going with steady workouts, solid meals, and disciplined recovery.',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/20',
    }
  }

  return {
    label: 'Overweight',
    textClass: 'text-rose-400',
    accent: '#FB7185',
    summary: 'Needs reduction',
    guidance: 'You have a clear target to work toward. Consistent training and smarter nutrition choices can bring you back into the healthy range.',
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
