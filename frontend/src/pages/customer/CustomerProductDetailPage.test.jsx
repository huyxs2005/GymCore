import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerProductDetailPage from './CustomerProductDetailPage'

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
    getProductDetail: vi.fn(),
    createReview: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
  },
}))

vi.mock('../../features/product/api/cartApi', () => ({
  cartApi: {
    addItem: vi.fn(),
  },
}))

vi.mock('../../features/product/utils/cartAnimation', () => ({
  triggerAddToCartAnimation: vi.fn(),
}))

const { productApi } = await import('../../features/product/api/productApi')
const { cartApi } = await import('../../features/product/api/cartApi')
const { triggerAddToCartAnimation } = await import('../../features/product/utils/cartAnimation')

function renderPage() {
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-probe">{location.pathname}</div>
  }

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/customer/shop/1']}>
        <Routes>
          <Route path="/customer/shop/:productId" element={<><CustomerProductDetailPage /><LocationProbe /></>} />
          <Route path="/customer/cart" element={<div data-testid="location-probe">/customer/cart</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerProductDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    cartApi.addItem.mockResolvedValue({ added: true })
    productApi.createReview.mockResolvedValue({ created: true })
    productApi.updateReview.mockResolvedValue({ updated: true })
    productApi.deleteReview.mockResolvedValue({ deleted: true })
    productApi.getProductDetail.mockResolvedValue({
      product: {
        productId: 1,
        name: 'Whey Protein',
        shortDescription: 'Recovery shake',
        description: 'Protein powder',
        usageInstructions: 'Mix 1 scoop after training.',
        price: 2000,
        averageRating: 4.5,
        reviewCount: 3,
        thumbnailUrl: 'https://cdn.example/whey.jpg',
        imageUrl: 'https://cdn.example/whey.jpg',
        canReview: true,
        myReview: null,
        categories: [{ productCategoryId: 1, name: 'Protein' }],
        images: [
          { productImageId: 1, imageUrl: 'https://cdn.example/whey.jpg', altText: 'Front', isPrimary: true },
          { productImageId: 2, imageUrl: 'https://cdn.example/whey-side.jpg', altText: 'Side', isPrimary: false },
        ],
      },
      reviews: Array.from({ length: 12 }, (_, index) => ({
        productReviewId: 11 + index,
        customerName: `Customer ${index + 1}`,
        avatarUrl: index === 0 ? 'https://cdn.example/avatar-customer-1.jpg' : null,
        rating: (index % 5) + 1,
        comment: `Review comment ${index + 1}`,
        reviewDate: `2026-03-${String((index % 9) + 1).padStart(2, '0')}T10:00:00`,
      })),
    })
  })

  it('renders the full gallery and usage instructions on a dedicated product page', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: /Whey Protein/i })).toBeInTheDocument()
    expect(screen.getByText(/How to use/i)).toBeInTheDocument()
    expect(screen.getByText(/Mix 1 scoop after training/i)).toBeInTheDocument()
    await user.click(screen.getByRole('img', { name: /Side/i }))
    expect(screen.getByRole('img', { name: /Whey Protein/i })).toBeInTheDocument()
  })

  it('adds the selected quantity to cart from the detail page', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: /Whey Protein/i })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: '+' })[0])
    await user.click(screen.getByRole('button', { name: /Add to cart/i }))

    await waitFor(() => {
      expect(cartApi.addItem.mock.calls[0][0]).toEqual({ productId: 1, quantity: 2 })
      expect(triggerAddToCartAnimation).toHaveBeenCalled()
    })
  })

  it('supports buy now from the detail page and routes to the cart page', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: /Whey Protein/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Buy now/i }))

    await waitFor(() => {
      expect(cartApi.addItem.mock.calls[0][0]).toEqual({ productId: 1, quantity: 1 })
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/customer/cart')
    })
  })

  it('lets a picked-up customer submit a first review from the detail page', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: /Whey Protein/i })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Rating/i), '4')
    await user.type(screen.getByPlaceholderText(/Share your experience with this product/i), 'Clean taste and easy to digest.')
    await user.click(screen.getByRole('button', { name: /Submit review/i }))

    await waitFor(() => {
      expect(productApi.createReview).toHaveBeenCalledWith(1, {
        rating: 4,
        comment: 'Clean taste and easy to digest.',
      })
    })
  })

  it('prefills and updates an existing review from the detail page', async () => {
    const user = userEvent.setup()
    productApi.getProductDetail.mockResolvedValueOnce({
      product: {
        productId: 1,
        name: 'Whey Protein',
        description: 'Protein powder',
        usageInstructions: 'Mix 1 scoop after training.',
        price: 2000,
        averageRating: 4.5,
        reviewCount: 3,
        canReview: true,
        myReview: {
          reviewId: 91,
          rating: 5,
          comment: 'Strong results',
        },
        categories: [],
        images: [],
      },
      reviews: [],
    })

    renderPage()

    expect(await screen.findByDisplayValue('Strong results')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Rating/i), '3')
    await user.clear(screen.getByDisplayValue('Strong results'))
    await user.type(screen.getByPlaceholderText(/Share your experience with this product/i), 'Solid value but mixes slowly.')
    await user.click(screen.getByRole('button', { name: /Update review/i }))

    await waitFor(() => {
      expect(productApi.updateReview).toHaveBeenCalledWith(1, {
        rating: 3,
        comment: 'Solid value but mixes slowly.',
      })
    })
  })

  it('lets a customer delete an existing review from the detail page', async () => {
    const user = userEvent.setup()
    productApi.getProductDetail.mockResolvedValueOnce({
      product: {
        productId: 1,
        name: 'Whey Protein',
        description: 'Protein powder',
        usageInstructions: 'Mix 1 scoop after training.',
        price: 2000,
        averageRating: 4.5,
        reviewCount: 3,
        canReview: true,
        myReview: {
          reviewId: 91,
          rating: 5,
          comment: 'Strong results',
        },
        categories: [],
        images: [],
      },
      reviews: [],
    })

    renderPage()

    expect(await screen.findByRole('button', { name: /Delete review/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Delete review/i }))
    await user.click(screen.getByRole('button', { name: /Confirm delete/i }))

    await waitFor(() => {
      expect(productApi.deleteReview.mock.calls[0][0]).toBe(1)
    })
  })

  it('shows 10 reviews per page and lets the customer paginate through them', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Review comment 1')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Customer 1 avatar/i })).toBeInTheDocument()
    expect(screen.getByText('Review comment 10')).toBeInTheDocument()
    expect(screen.queryByText('Review comment 11')).not.toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Next/i }))

    expect(await screen.findByText('Review comment 11')).toBeInTheDocument()
    expect(screen.getByText('Review comment 12')).toBeInTheDocument()
    expect(screen.queryByText('Review comment 1')).not.toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Previous/i }))

    expect(await screen.findByText('Review comment 1')).toBeInTheDocument()
    expect(screen.queryByText('Review comment 11')).not.toBeInTheDocument()
  })

  it('shows initials fallback when a review has no avatar', async () => {
    renderPage()

    expect(await screen.findByText('Review comment 2')).toBeInTheDocument()
    expect(screen.getByText('C2')).toBeInTheDocument()
  })
})


