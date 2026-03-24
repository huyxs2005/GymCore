import { describe, expect, it } from 'vitest'
import { calculateBmiResult } from './bmi'

describe('calculateBmiResult', () => {
  const cases = [
    ['UTCID01', 165, 49],
    ['UTCID02', 165, 57],
    ['UTCID03', 170, 80],
    ['UTCID04', 170, 0.1],
    ['UTCID05', 0.1, 70],
    ['UTCID06', null, 70],
    ['UTCID07', 170, null],
    ['UTCID08', 'abc', 70],
    ['UTCID09', 170, 'abc'],
    ['UTCID10', 0, 70],
    ['UTCID11', 170, 0],
  ]

  it('prints the BMI result table for all scenarios', () => {
    const rows = cases.map(([scenario, height, weight]) => {
      const result = calculateBmiResult(height, weight)
      return {
        scenario,
        height,
        weight,
        hasBmi: result.ok,
        bmi: result.ok ? result.bmi : 'N/A',
        message: result.ok ? result.label : result.error,
      }
    })

    console.table(rows)
    expect(rows).toHaveLength(cases.length)
  })

  it.each(cases)('handles %s', (scenario, height, weight) => {
    const result = calculateBmiResult(height, weight)

    if (result.ok) {
      expect(result.ok).toBe(true)
      expect(typeof result.bmi).toBe('number')
      expect(['Underweight', 'Normal', 'Overweight']).toContain(result.label)
      expect(result.summary).toBeTruthy()

      if (scenario === 'UTCID01' || scenario === 'UTCID04') {
        expect(result.label).toBe('Underweight')
      }
      if (scenario === 'UTCID02') {
        expect(result.label).toBe('Normal')
      }
      if (scenario === 'UTCID03' || scenario === 'UTCID05') {
        expect(result.label).toBe('Overweight')
      }
    } else {
      expect(result).toMatchObject({
        ok: false,
        error: 'Invalid height or weight.',
      })
      expect(result.bmi).toBeUndefined()
    }
  })
})


