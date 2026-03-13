import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerProgressHubPage from './CustomerProgressHubPage'

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
    getUtilitySnapshot: vi.fn(),
  },
}))

vi.mock('../../features/health/api/healthApi', () => ({
  healthApi: {
    getProgressHub: vi.fn(),
  },
}))

import { checkinApi } from '../../features/checkin/api/checkinApi'
import { healthApi } from '../../features/health/api/healthApi'

function renderPage() {
  return render(
    <MemoryRouter>
      <CustomerProgressHubPage />
    </MemoryRouter>,
  )
}

describe('CustomerProgressHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    healthApi.getProgressHub.mockResolvedValue({
      data: {
        currentSnapshot: {
          heightCm: 172.5,
          weightKg: 70.2,
          bmi: 23.6,
          updatedAt: '2026-03-10T08:00:00Z',
        },
        healthHistory: {
          items: [
            {
              recordedAt: '2026-03-10T08:00:00Z',
              heightCm: 172.5,
              weightKg: 70.2,
              bmi: 23.6,
            },
          ],
        },
        recentCoachNotes: {
          items: [
            {
              noteId: 31,
              coachName: 'Coach Alex',
              sessionDate: '2026-03-11',
              noteContent: 'Form is improving each week.',
            },
          ],
        },
        latestCoachingSignal: {
          sourceType: 'COACH_NOTE',
          summary: 'Form is improving each week.',
          recordedAt: '2026-03-11T10:30:00Z',
          coachName: 'Coach Alex',
        },
        ptContext: {
          hasActivePt: true,
          currentPtStatus: 'APPROVED',
          completedSessions: 2,
          remainingSessions: 4,
          coach: {
            coachName: 'Coach Alex',
          },
          nextSession: {
            sessionDate: '2026-03-15',
            coachName: 'Coach Alex',
            startTime: '07:00:00',
            endTime: '08:30:00',
          },
        },
        followUp: {
          historyCount: 2,
          recommendedFocus: 'PREPARE_FOR_NEXT_PT_SESSION',
          nextSessionDate: '2026-03-15',
        },
      },
    })

    checkinApi.getUtilitySnapshot.mockResolvedValue({
      qr: {
        data: { qrCodeToken: 'gymcore-qr-token' },
      },
      history: {
        data: {
          items: [
            {
              checkInId: 17,
              checkInTime: '2026-03-12T07:30:00Z',
              planName: 'Gym + Coach - 6 Months',
              checkedByName: 'Receptionist Linh',
            },
          ],
        },
      },
    })
  })

  it('renders progress-first health, coach, and PT context from the aggregate contract', async () => {
    renderPage()

    expect(await screen.findByText('One place for your current progress and PT follow-up')).toBeInTheDocument()
    expect(screen.getAllByText('Form is improving each week.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Coach Alex').length).toBeGreaterThan(0)
    expect(screen.getByText('PT active')).toBeInTheDocument()
    expect(screen.getByText('Prepare For Next Pt Session')).toBeInTheDocument()
    expect(screen.getByText('2 completed / 4 remaining PT sessions')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open PT dashboard/i })).toHaveAttribute('href', '/customer/coach-booking')
  })

  it('renders empty-state fallback copy when progress data is sparse', async () => {
    healthApi.getProgressHub.mockResolvedValueOnce({
      data: {
        currentSnapshot: {},
        healthHistory: { items: [] },
        recentCoachNotes: { items: [] },
        latestCoachingSignal: {
          sourceType: 'HEALTH_SNAPSHOT',
          summary: 'No coaching signal recorded yet.',
          recordedAt: null,
        },
        ptContext: {
          hasActivePt: false,
          currentPtStatus: 'NONE',
          completedSessions: 0,
          remainingSessions: 0,
          coach: {},
          nextSession: {},
        },
        followUp: {
          historyCount: 0,
          recommendedFocus: 'COMPLETE_BASELINE_CHECK_IN',
        },
      },
    })
    checkinApi.getUtilitySnapshot.mockResolvedValueOnce({
      qr: { data: {} },
      history: { data: { items: [] } },
    })

    renderPage()

    expect(await screen.findByText('PT not active')).toBeInTheDocument()
    expect(screen.getByText('No coaching signal recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('No coach notes available yet.')).toBeInTheDocument()
    expect(screen.getByText('No health history recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('QR unavailable')).toBeInTheDocument()
  })
})
