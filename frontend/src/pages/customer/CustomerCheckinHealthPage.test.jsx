import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerCheckinHealthPage from './CustomerCheckinHealthPage'
import { getBmiLevel } from '../../features/health/utils/bmi'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: function WorkspaceScaffold({ title, children }) {
    return (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    )
  },
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: (_value, _options, callback) => callback(null, 'data:image/png;base64,mock'),
  },
}))

vi.mock('../../features/checkin/api/checkinApi', () => ({
  checkinApi: {
    getQrToken: vi.fn(),
    getHistory: vi.fn(),
    getCoachNotes: vi.fn(),
  },
}))

vi.mock('../../features/health/api/healthApi', () => ({
  healthApi: {
    getCurrent: vi.fn(),
    getHistory: vi.fn(),
    createRecord: vi.fn(),
  },
}))

import { checkinApi } from '../../features/checkin/api/checkinApi'
import { healthApi } from '../../features/health/api/healthApi'

describe('getBmiLevel', () => {
  it('returns the empty-state guidance when BMI is null', () => {
    expect(getBmiLevel(null)).toEqual({
      label: 'No data',
      textClass: 'text-slate-500',
      accent: '#94A3B8',
      summary: 'Add your latest body metrics',
      guidance: 'Enter height and weight to generate your BMI trend and healthy-weight target.',
    })
  })

  it('classifies BMI below 18.5 as Underweight', () => {
    expect(getBmiLevel(18.4)).toMatchObject({
      label: 'Underweight',
      summary: 'Needs gain',
      accent: '#2F9AE0',
    })
  })

  it('classifies the 18.5 boundary as Normal', () => {
    expect(getBmiLevel(18.5)).toMatchObject({
      label: 'Normal',
      summary: 'Healthy',
      accent: '#42BE65',
    })
  })

  it('keeps BMI 24.9 inside the Normal range', () => {
    expect(getBmiLevel(24.9)).toMatchObject({
      label: 'Normal',
      summary: 'Healthy',
      accent: '#42BE65',
    })
  })

  it('classifies the 25.0 boundary as Overweight', () => {
    expect(getBmiLevel(25)).toMatchObject({
      label: 'Overweight',
      summary: 'Needs reduction',
      accent: '#FF5A4E',
    })
  })

  it('treats undefined BMI as no data', () => {
    expect(getBmiLevel(undefined)).toMatchObject({
      label: 'No data',
      summary: 'Add your latest body metrics',
    })
  })

  it('keeps the 16.0 lower gauge boundary in the underweight range', () => {
    expect(getBmiLevel(16)).toMatchObject({
      label: 'Underweight',
      summary: 'Needs gain',
    })
  })

  it('classifies very low BMI as Underweight', () => {
    expect(getBmiLevel(10)).toMatchObject({
      label: 'Underweight',
      summary: 'Needs gain',
    })
  })

  it('classifies BMI 17.0 as Underweight', () => {
    expect(getBmiLevel(17)).toMatchObject({
      label: 'Underweight',
      summary: 'Needs gain',
    })
  })

  it('classifies BMI 18.49 as Underweight', () => {
    expect(getBmiLevel(18.49)).toMatchObject({
      label: 'Underweight',
      summary: 'Needs gain',
    })
  })

  it('classifies BMI 20.0 as Normal', () => {
    expect(getBmiLevel(20)).toMatchObject({
      label: 'Normal',
      summary: 'Healthy',
    })
  })

  it('classifies BMI 24.0 as Normal', () => {
    expect(getBmiLevel(24)).toMatchObject({
      label: 'Normal',
      summary: 'Healthy',
    })
  })

  it('classifies BMI 26.0 as Overweight', () => {
    expect(getBmiLevel(26)).toMatchObject({
      label: 'Overweight',
      summary: 'Needs reduction',
    })
  })

  it('classifies BMI 30.0 as Overweight', () => {
    expect(getBmiLevel(30)).toMatchObject({
      label: 'Overweight',
      summary: 'Needs reduction',
    })
  })

  it('classifies BMI 40.0 as Overweight', () => {
    expect(getBmiLevel(40)).toMatchObject({
      label: 'Overweight',
      summary: 'Needs reduction',
    })
  })
})

describe('CustomerCheckinHealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    checkinApi.getQrToken.mockResolvedValue({
      data: { qrCodeToken: 'gymcore-qr-token' },
    })
    checkinApi.getHistory.mockResolvedValue({
      data: { items: [] },
    })
    checkinApi.getCoachNotes.mockResolvedValue({
      data: { items: [] },
    })
    healthApi.getCurrent.mockResolvedValue({
      data: {
        heightCm: 165,
        weightKg: 60,
        bmi: 22,
        updatedAt: '2026-03-02T00:00:00.000Z',
      },
    })
    healthApi.getHistory.mockResolvedValue({
      data: { items: [] },
    })
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <CustomerCheckinHealthPage />
      </MemoryRouter>,
    )
  }

  it('renders the BMI gauge summary and healthy interpretation in English', async () => {
    renderPage()

    expect(await screen.findByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('Within target')).toBeInTheDocument()
    expect(screen.getByText(/Your BMI is inside the normal range/i)).toBeInTheDocument()
    expect(screen.getByText(/Healthy Weight/i)).toBeInTheDocument()
    expect(screen.getByText('50.4 - 67.8 kg')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Progress Hub/i })).toHaveAttribute('href', '/customer/progress-hub')
  })

  it('renders a neutral empty state when no current health record exists', async () => {
    healthApi.getCurrent.mockResolvedValueOnce({
      data: {},
    })

    renderPage()

    expect(await screen.findByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Add your latest body metrics')).toBeInTheDocument()
    expect(screen.getByText(/Enter height and weight to generate your BMI trend/i)).toBeInTheDocument()
    expect(screen.getAllByText('--').length).toBeGreaterThan(0)
  })
})


