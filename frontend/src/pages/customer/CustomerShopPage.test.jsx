import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerShopPage from './CustomerShopPage'

const mockSessionUser = {
  userId: 5,
  fullName: 'Customer Minh',
  email: 'customer@gymcore.local',
  phone: '0900000004',
  role: 'CUSTOMER',
}

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/auth/useSession', () => ({
  useSession: () => ({
    user: mockSessionUser,
    isAuthenticated: true,
  }),
}))

vi.mock('../../features/product/api/productApi', () => ({
  productApi: {
    getProducts: vi.fn(),
  },
}))

vi.mock('../../features/product/api/cartApi', () => ({
  cartApi: {
    getCart: vi.fn(),
    addItem: vi.fn(),
  },
}))

vi.mock('../../features/product/api/orderApi', () => ({
  orderApi: {
    confirmPaymentReturn: vi.fn(),
  },
}))

vi.mock('../../features/product/utils/cartAnimation', () => ({
  triggerAddToCartAnimation: vi.fn(),
}))

const { productApi } = await import('../../features/product/api/productApi')
const { cartApi } = await import('../../features/product/api/cartApi')
const { orderApi } = await import('../../features/product/api/orderApi')
const { triggerAddToCartAnimation } = await import('../../features/product/utils/cartAnimation')

function renderWithQuery(ui) {
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-probe">{location.pathname}</div>
  }

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/customer/shop']}>
        <Routes>
          <Route path="/customer/shop" element={<>{ui}<LocationProbe /></>} />
          <Route path="/customer/cart" element={<div data-testid="location-probe">/customer/cart</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerShopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    window.history.replaceState({}, document.title, '/customer/shop')

    productApi.getProducts.mockResolvedValue({
      categories: [
        { productCategoryId: 1, name: 'Protein' },
        { productCategoryId: 2, name: 'Creatine' },
      ],
      products: [
        {
          productId: 1,
          name: 'Whey Protein',
          shortDescription: 'Recovery shake',
          description: 'Protein powder',
          price: 2000,
          averageRating: 4.5,
          reviewCount: 3,
          thumbnailUrl: 'https://cdn.example/whey.jpg',
          categories: [{ productCategoryId: 1, name: 'Protein' }],
        },
        {
          productId: 2,
          name: 'Creatine Monohydrate',
          shortDescription: 'Strength support',
          description: 'Creatine powder',
          price: 1000,
          averageRating: 4.2,
          reviewCount: 2,
          thumbnailUrl: 'https://cdn.example/creatine.jpg',
          categories: [{ productCategoryId: 2, name: 'Creatine' }],
        },
      ],
    })
    cartApi.getCart.mockResolvedValue({
      items: [
        {
          productId: 1,
          name: 'Whey Protein',
          price: 2000,
          quantity: 2,
          lineTotal: 4000,
        },
      ],
      subtotal: 4000,
      currency: 'VND',
    })
    cartApi.addItem.mockResolvedValue({ added: true })
    orderApi.confirmPaymentReturn.mockResolvedValue({})
  })

  it('renders the catalog and links products to dedicated detail pages plus the cart page', async () => {
    renderWithQuery(<CustomerShopPage />)

    expect(await screen.findByText(/Catalog/i)).toBeInTheDocument()
    const wheyLinks = await screen.findAllByRole('link', { name: /Whey Protein/i })
    const detailLinks = await screen.findAllByText(/View details/i)
    expect(screen.getByRole('link', { name: /View buying history/i })).toHaveAttribute('href', '/customer/orders')
    expect(screen.getByRole('link', { name: /View cart/i })).toHaveAttribute('href', '/customer/cart')
    expect(wheyLinks[0]).toHaveAttribute('href', '/customer/shop/1')
    expect(detailLinks[0].closest('a')).toHaveAttribute('href', '/customer/shop/1')
    expect(screen.getAllByRole('link', { name: /Creatine Monohydrate/i })[0]).toHaveAttribute('href', '/customer/shop/2')
  })

  it('filters products by category in the catalog page', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CustomerShopPage />)

    expect((await screen.findAllByRole('link', { name: /Whey Protein/i })).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Creatine' }))

    expect(screen.getAllByRole('link', { name: /Creatine Monohydrate/i }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('link', { name: /Whey Protein/i })).toHaveLength(0)
  })

  it('adds an item to cart from the catalog and triggers the cart animation', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CustomerShopPage />)

    const addButtons = await screen.findAllByRole('button', { name: /Add to cart/i })
    await user.click(addButtons[0])

    await waitFor(() => {
      expect(cartApi.addItem.mock.calls[0][0]).toEqual({ productId: 1, quantity: 1 })
      expect(triggerAddToCartAnimation).toHaveBeenCalled()
    })
  })

  it('supports buy now from the catalog and routes to the cart page', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CustomerShopPage />)

    const buyNowButtons = await screen.findAllByRole('button', { name: /Buy now/i })
    await user.click(buyNowButtons[0])

    await waitFor(() => {
      expect(cartApi.addItem.mock.calls[0][0]).toEqual({ productId: 1, quantity: 1 })
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/customer/cart')
    })
  })

  it('handles payment return success on the shop page if PayOS returns there', async () => {
    window.history.replaceState({}, document.title, '/customer/shop?status=PAID&orderCode=12345')

    renderWithQuery(<CustomerShopPage />)

    await waitFor(() => {
      expect(orderApi.confirmPaymentReturn).toHaveBeenCalledWith({
        status: 'PAID',
        orderCode: '12345',
      })
    })
  })
})
