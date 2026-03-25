import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminInvoicesPage from './AdminInvoicesPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../features/auth/useSession', () => ({
  useSession: vi.fn(),
}))

vi.mock('../../features/product/api/adminInvoiceApi', () => ({
  adminInvoiceApi: {
    getInvoices: vi.fn(),
    getInvoiceDetail: vi.fn(),
    confirmPickup: vi.fn(),
    resendEmail: vi.fn(),
  },
}))

const { useSession } = await import('../../features/auth/useSession')
const { adminInvoiceApi } = await import('../../features/product/api/adminInvoiceApi')

function renderWithQuery(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('AdminInvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSession.mockReturnValue({
      user: { role: 'ADMIN' },
      isAuthenticated: true,
    })
    adminInvoiceApi.getInvoices.mockResolvedValue({
      pickupTrackingAvailable: true,
      invoices: [
        {
          invoiceId: 10,
          invoiceCode: 'INV-SENT',
          orderId: 17,
          paymentId: 900,
          customerAccountName: 'Customer Minh',
          customerAccountEmail: 'customer@gymcore.local',
          recipientName: 'Customer Minh',
          recipientEmail: 'customer@gymcore.local',
          totalAmount: 3600,
          currency: 'VND',
          paidAt: '2026-03-07T10:00:00',
          pickedUpAt: null,
          emailSentAt: '2026-03-07T10:05:00',
          emailSendError: null,
        },
        {
          invoiceId: 11,
          invoiceCode: 'INV-PICKED',
          orderId: 18,
          paymentId: 901,
          customerAccountName: 'Customer Minh',
          customerAccountEmail: 'customer@gymcore.local',
          recipientName: 'Customer Minh',
          recipientEmail: 'customer@gymcore.local',
          totalAmount: 2000,
          currency: 'VND',
          paidAt: '2026-03-07T11:00:00',
          pickedUpAt: '2026-03-07T12:00:00',
          emailSentAt: null,
          emailSendError: 'SMTP down',
        },
      ],
    })
    adminInvoiceApi.getInvoiceDetail.mockImplementation(async (invoiceId) => ({
      pickupTrackingAvailable: true,
      invoice: {
        invoiceId,
        invoiceCode: invoiceId === 10 ? 'INV-SENT' : 'INV-PICKED',
        orderId: invoiceId === 10 ? 17 : 18,
        paymentId: invoiceId === 10 ? 900 : 901,
        customerAccountName: 'Customer Minh',
        customerAccountEmail: 'customer@gymcore.local',
        recipientName: 'Customer Minh',
        recipientEmail: 'customer@gymcore.local',
        shippingPhone: '0900000004',
        shippingAddress: null,
        paymentMethod: 'PAYOS',
        subtotal: invoiceId === 10 ? 4000 : 2300,
        discountAmount: invoiceId === 10 ? 400 : 300,
        totalAmount: invoiceId === 10 ? 3600 : 2000,
        currency: 'VND',
        paidAt: invoiceId === 10 ? '2026-03-07T10:00:00' : '2026-03-07T11:00:00',
        pickedUpAt: invoiceId === 10 ? null : '2026-03-07T12:00:00',
        pickedUpByName: invoiceId === 10 ? null : 'Receptionist GymCore',
        emailSentAt: invoiceId === 10 ? '2026-03-07T10:05:00' : null,
        emailSendError: invoiceId === 10 ? null : 'SMTP down',
      },
      items: [
        {
          invoiceItemId: 1,
          productName: invoiceId === 10 ? 'Whey Protein' : 'Creatine',
          quantity: invoiceId === 10 ? 2 : 1,
          unitPrice: invoiceId === 10 ? 2000 : 2000,
          lineTotal: invoiceId === 10 ? 4000 : 2000,
        },
      ],
    }))
    adminInvoiceApi.confirmPickup.mockResolvedValue({ invoice: { invoiceId: 10 } })
    adminInvoiceApi.resendEmail.mockResolvedValue({ invoice: { invoiceId: 11 } })
  })

  it('renders invoices and invoice detail', async () => {
    renderWithQuery(<AdminInvoicesPage />)

    expect(await screen.findByText('INV-SENT')).toBeInTheDocument()
    expect(await screen.findByText(/Whey Protein/i)).toBeInTheDocument()
    expect(screen.getByText(/Pickup instruction/i)).toBeInTheDocument()
    expect(screen.getByText(/Customer presents Order #17/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Awaiting pickup/i).length).toBeGreaterThan(0)
  })

  it('confirms pickup from the invoice detail panel', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminInvoicesPage />)

    await user.click(await screen.findByRole('button', { name: /Confirm pickup/i }))

    await waitFor(() => {
      expect(adminInvoiceApi.confirmPickup.mock.calls[0][0]).toBe(10)
    })
  })

  it('retries invoice email from the detail panel when delivery failed', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminInvoicesPage />)

    await user.click(await screen.findByText('INV-PICKED'))
    await user.click(await screen.findByRole('button', { name: /Retry email/i }))

    await waitFor(() => {
      expect(adminInvoiceApi.resendEmail).toHaveBeenCalledWith(11, expect.anything())
    })
  })

  it('uses receptionist copy for receptionist role', async () => {
    useSession.mockReturnValue({
      user: { role: 'RECEPTIONIST' },
      isAuthenticated: true,
    })

    renderWithQuery(<AdminInvoicesPage />)

    expect(await screen.findByText(/Reception Invoice Center/i)).toBeInTheDocument()
    expect(screen.getByText(/front-desk handoff/i)).toBeInTheDocument()
  })

  it('filters invoice list by pickup and email state', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminInvoicesPage />)

    expect(await screen.findByText('INV-SENT')).toBeInTheDocument()
    expect(screen.getByText('INV-PICKED')).toBeInTheDocument()

    const comboboxes = screen.getAllByRole('combobox')
    await user.selectOptions(comboboxes[0], 'picked')

    expect(await screen.findByRole('row', { name: /INV-PICKED/i })).toBeInTheDocument()

    await user.selectOptions(comboboxes[1], 'failed')
    expect(screen.getByText(/Email failed/i)).toBeInTheDocument()
  })

  it('shows a schema warning and disables pickup confirmation when pickup tracking is unavailable', async () => {
    adminInvoiceApi.getInvoices.mockResolvedValueOnce({
      pickupTrackingAvailable: false,
      invoices: [
        {
          invoiceId: 12,
          invoiceCode: 'INV-LEGACY',
          orderId: 19,
          paymentId: 902,
          customerAccountName: 'Customer Minh',
          customerAccountEmail: 'customer@gymcore.local',
          recipientName: 'Customer Minh',
          recipientEmail: 'customer@gymcore.local',
          totalAmount: 2200,
          currency: 'VND',
          paidAt: '2026-03-07T13:00:00',
          pickedUpAt: null,
          emailSentAt: null,
          emailSendError: null,
        },
      ],
    })
    adminInvoiceApi.getInvoiceDetail.mockResolvedValueOnce({
      pickupTrackingAvailable: false,
      invoice: {
        invoiceId: 12,
        invoiceCode: 'INV-LEGACY',
        orderId: 19,
        paymentId: 902,
        customerAccountName: 'Customer Minh',
        customerAccountEmail: 'customer@gymcore.local',
        recipientName: 'Customer Minh',
        recipientEmail: 'customer@gymcore.local',
        shippingPhone: '0900000004',
        shippingAddress: null,
        paymentMethod: 'PAYOS',
        subtotal: 2200,
        discountAmount: 0,
        totalAmount: 2200,
        currency: 'VND',
        paidAt: '2026-03-07T13:00:00',
        pickedUpAt: null,
        pickedUpByName: null,
        emailSentAt: null,
        emailSendError: null,
      },
      items: [],
    })

    renderWithQuery(<AdminInvoicesPage />)

    expect(await screen.findByText(/Pickup tracking is unavailable on this database/i)).toBeInTheDocument()
    expect(screen.getByText(/Not tracked/i)).toBeInTheDocument()
    expect(await screen.findByText(/Pickup tracking is unavailable on the current database schema/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pickup tracking unavailable/i })).toBeDisabled()
    expect(screen.getAllByRole('combobox')[0]).toBeDisabled()
  })
})
