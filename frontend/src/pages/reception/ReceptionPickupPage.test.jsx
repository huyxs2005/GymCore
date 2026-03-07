import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReceptionPickupPage from './ReceptionPickupPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../features/product/api/adminInvoiceApi', () => ({
  adminInvoiceApi: {
    getInvoices: vi.fn(),
    getInvoiceDetail: vi.fn(),
    confirmPickup: vi.fn(),
  },
}))

const { adminInvoiceApi } = await import('../../features/product/api/adminInvoiceApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reception/pickup']}>
        <ReceptionPickupPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReceptionPickupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminInvoiceApi.getInvoices.mockResolvedValue({
      invoices: [
        {
          invoiceId: 301,
          invoiceCode: 'INV-AWAITING',
          orderId: 17,
          paymentId: 901,
          customerAccountName: 'Customer Minh',
          customerAccountEmail: 'customer@gymcore.local',
          recipientName: 'Customer Minh',
          recipientEmail: 'customer@gymcore.local',
          totalAmount: 3600,
          currency: 'VND',
          paidAt: '2026-03-07T10:05:00',
          pickedUpAt: null,
          emailSentAt: '2026-03-07T10:06:00',
          emailSendError: null,
        },
        {
          invoiceId: 302,
          invoiceCode: 'INV-PICKED',
          orderId: 18,
          paymentId: 902,
          customerAccountName: 'Customer Minh',
          customerAccountEmail: 'customer@gymcore.local',
          recipientName: 'Customer Minh',
          recipientEmail: 'customer@gymcore.local',
          totalAmount: 2200,
          currency: 'VND',
          paidAt: '2026-03-06T09:00:00',
          pickedUpAt: '2026-03-06T10:00:00',
          emailSentAt: null,
          emailSendError: 'SMTP failed',
        },
      ],
    })

    adminInvoiceApi.getInvoiceDetail.mockImplementation(async (invoiceId) => ({
      invoice: {
        invoiceId,
        invoiceCode: invoiceId === 301 ? 'INV-AWAITING' : 'INV-PICKED',
        orderId: invoiceId === 301 ? 17 : 18,
        paymentMethod: 'PAYOS',
        customerAccountName: 'Customer Minh',
        customerAccountEmail: 'customer@gymcore.local',
        recipientName: 'Customer Minh',
        recipientEmail: 'customer@gymcore.local',
        shippingPhone: '0900000004',
        subtotal: invoiceId === 301 ? 4000 : 2500,
        discountAmount: invoiceId === 301 ? 400 : 300,
        totalAmount: invoiceId === 301 ? 3600 : 2200,
        currency: 'VND',
        paidAt: '2026-03-07T10:05:00',
        pickedUpAt: invoiceId === 301 ? null : '2026-03-06T10:00:00',
        pickedUpByName: invoiceId === 301 ? null : 'Receptionist GymCore',
        emailSentAt: invoiceId === 301 ? '2026-03-07T10:06:00' : null,
        emailSendError: invoiceId === 301 ? null : 'SMTP failed',
      },
      items: [
        {
          invoiceItemId: 1,
          productName: invoiceId === 301 ? 'Whey Protein' : 'Creatine',
          quantity: 1,
          unitPrice: invoiceId === 301 ? 2000 : 1100,
          lineTotal: invoiceId === 301 ? 2000 : 1100,
        },
      ],
    }))

    adminInvoiceApi.confirmPickup.mockResolvedValue({ pickedUp: true })
  })

  it('renders the pickup queue and handoff detail', async () => {
    renderPage()

    expect(await screen.findByText(/Reception Pickup Desk/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'INV-AWAITING' })).toBeInTheDocument()
    expect(await screen.findByText(/Ask for order ID/i)).toBeInTheDocument()
    expect(screen.getByText('Whey Protein')).toBeInTheDocument()
  })

  it('filters by pickup state and email state', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: 'INV-AWAITING' })).toBeInTheDocument()

    const filters = screen.getAllByRole('combobox')
    await user.selectOptions(filters[0], 'picked')
    expect(await screen.findByRole('heading', { name: 'INV-PICKED' })).toBeInTheDocument()
    expect(await screen.findByText(/Handled by:/i)).toBeInTheDocument()

    await user.selectOptions(filters[1], 'failed')
    expect(screen.getByText(/SMTP failed/i)).toBeInTheDocument()
  })

  it('confirms pickup from the handoff panel', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Confirm pickup/i }))

    await waitFor(() => {
      expect(adminInvoiceApi.confirmPickup).toHaveBeenCalledWith(301, expect.anything())
    })
  })

  it('shows empty-state when search removes all pickup receipts', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByPlaceholderText(/Search order ID, invoice code, customer email/i), 'NO_MATCH')

    expect(await screen.findByText(/No pickup receipts match the current search/i)).toBeInTheDocument()
  })

  it('keeps confirm pickup disabled for already handed-over receipts', async () => {
    const user = userEvent.setup()
    renderPage()

    const filters = await screen.findAllByRole('combobox')
    await user.selectOptions(filters[0], 'picked')

    const button = await screen.findByRole('button', { name: /Pickup confirmed/i })
    expect(button).toBeDisabled()
  })
})
