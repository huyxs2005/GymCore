import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomerCheckinHealthPage from './CustomerCheckinHealthPage'

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

  it('renders the BMI gauge summary and healthy interpretation in English', async () => {
    render(<CustomerCheckinHealthPage />)

    expect(await screen.findByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('Within target')).toBeInTheDocument()
    expect(screen.getByText(/Your BMI is inside the normal range/i)).toBeInTheDocument()
    expect(screen.getByText(/Healthy Weight/i)).toBeInTheDocument()
    expect(screen.getByText('50.4 - 67.8 kg')).toBeInTheDocument()
  })

  it('renders a neutral empty state when no current health record exists', async () => {
    healthApi.getCurrent.mockResolvedValueOnce({
      data: {},
    })

    render(<CustomerCheckinHealthPage />)

    expect(await screen.findByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Add your latest body metrics')).toBeInTheDocument()
    expect(screen.getByText(/Enter height and weight to generate your BMI trend/i)).toBeInTheDocument()
    expect(screen.getAllByText('--').length).toBeGreaterThan(0)
  })
})
