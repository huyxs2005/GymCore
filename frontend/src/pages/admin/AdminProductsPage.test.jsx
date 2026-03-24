import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProductsPage from './AdminProductsPage'

vi.mock('../../features/product/api/adminProductApi', () => ({
  adminProductApi: {
    getProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadImage: vi.fn(),
    deleteUploadedImage: vi.fn(),
    archiveProduct: vi.fn(),
    restoreProduct: vi.fn(),
    getReviews: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  toast: {
    error: vi.fn(),
  },
}))

const { adminProductApi } = await import('../../features/product/api/adminProductApi')
const { toast } = await import('react-hot-toast')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/products']}>
        <AdminProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminProductApi.getProducts.mockResolvedValue({
      categories: [
        { productCategoryId: 1, name: 'Protein' },
        { productCategoryId: 2, name: 'Creatine' },
      ],
      products: [
        {
          productId: 7,
          name: 'Whey Protein',
          shortDescription: 'Recovery shake',
          description: 'Protein powder',
          usageInstructions: 'Mix 1 scoop',
          price: 2000,
          active: true,
          thumbnailUrl: 'https://cdn.example/whey.jpg',
          categories: [{ productCategoryId: 1, name: 'Protein' }],
          images: [{ productImageId: 1, imageUrl: 'https://cdn.example/whey.jpg', altText: 'Whey', displayOrder: 1, isPrimary: true }],
          reviewCount: 2,
          averageRating: 4.5,
        },
        {
          productId: 8,
          name: 'Creatine',
          shortDescription: 'Strength support',
          description: 'Creatine powder',
          usageInstructions: 'Take daily',
          price: 1100,
          active: false,
          thumbnailUrl: 'https://cdn.example/creatine.jpg',
          categories: [{ productCategoryId: 2, name: 'Creatine' }],
          images: [{ productImageId: 2, imageUrl: 'https://cdn.example/creatine.jpg', altText: 'Creatine', displayOrder: 1, isPrimary: true }],
          reviewCount: 0,
          averageRating: 0,
        },
      ],
    })
    adminProductApi.getReviews.mockResolvedValue({
      reviews: [
        { productReviewId: 10, productName: 'Whey Protein', customerName: 'Customer Minh', rating: 5, comment: 'Great' },
      ],
    })
    adminProductApi.createProduct.mockResolvedValue({ created: true, productId: 9 })
    adminProductApi.updateProduct.mockResolvedValue({ updated: true })
    adminProductApi.uploadImage.mockResolvedValue({ imageUrl: '/uploads/products/catalog/creatine.png' })
    adminProductApi.deleteUploadedImage.mockResolvedValue({ deleted: true })
    adminProductApi.archiveProduct.mockResolvedValue({ archived: true })
    adminProductApi.restoreProduct.mockResolvedValue({ restored: true })
  })

  it('renders the admin sidebar and submits the richer product form', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New product/i }))
    await user.type(screen.getByLabelText(/Product name/i), 'Creatine HCL')
    await user.type(screen.getByLabelText(/Short description/i), 'Daily strength support')
    await user.clear(screen.getByLabelText(/Price \(VND\)/i))
    await user.type(screen.getByLabelText(/Price \(VND\)/i), '1300')
    await user.click(screen.getAllByRole('button', { name: 'Creatine' })[0])
    await user.type(screen.getByPlaceholderText(/Alt text/i), 'Creatine jar')
    const fileInput = screen.getByLabelText(/Choose image 1/i)
    await user.upload(fileInput, new File([new Uint8Array([137, 80, 78, 71])], 'creatine.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: /Create product/i }))

    await waitFor(() => {
      expect(adminProductApi.uploadImage).toHaveBeenCalled()
      expect(adminProductApi.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Creatine HCL',
          shortDescription: 'Daily strength support',
          price: 1300,
          categoryIds: expect.arrayContaining([2]),
          images: [
            expect.objectContaining({
              imageUrl: '/uploads/products/catalog/creatine.png',
              altText: 'Creatine jar',
              isPrimary: true,
              displayOrder: 1,
            }),
          ],
        }),
      )
    })
  })

  it('collapses and expands the admin sidebar from the hamburger button', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Collapse admin sidebar/i }))
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Expand admin sidebar/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Expand admin sidebar/i }))
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })

  it('filters archived products and restores one', async () => {
    const user = userEvent.setup()
    renderPage()

    expect((await screen.findAllByText('Whey Protein')).length).toBeGreaterThan(0)
    await user.selectOptions(screen.getByDisplayValue(/All statuses/i), 'archived')

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Whey Protein' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: 'Creatine' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Restore/i }))
    await waitFor(() => {
      expect(adminProductApi.restoreProduct).toHaveBeenCalledWith(8, expect.anything())
    })
  })

  it('reorders and removes gallery images while editing', async () => {
    const user = userEvent.setup()
    renderPage()

    const editButtons = await screen.findAllByRole('button', { name: /^Edit$/i })
    await user.click(editButtons[0])
    await user.click(screen.getByRole('button', { name: /Add image/i }))
    const secondAlt = screen.getAllByPlaceholderText(/Alt text/i)[1]
    await user.type(secondAlt, 'Second view')
    const secondInput = screen.getByLabelText(/^Choose image 2$/i)
    await user.upload(secondInput, new File([new Uint8Array([137, 80, 78, 71])], 'second.png', { type: 'image/png' }))

    await waitFor(() => {
      expect(adminProductApi.uploadImage).toHaveBeenCalled()
    })

    const upButtons = screen.getAllByRole('button', { name: /^Up$/i })
    await user.click(upButtons[1])
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i })
    await user.click(removeButtons[1])

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(/Alt text/i)).toHaveLength(1)
    })
  })

  it('blocks oversized uploaded product images before the request is sent', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New product/i }))
    const fileInput = screen.getByLabelText(/Choose image 1/i)
    await user.upload(fileInput, new File([new Uint8Array((5 * 1024 * 1024) + 1)], 'huge.png', { type: 'image/png' }))

    expect(adminProductApi.uploadImage).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Product image file is too large. Maximum size is 5 MB.')
  })

  it('shows custom validation when required product fields are missing', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New product/i }))
    await user.click(screen.getByRole('button', { name: /Create product/i }))

    expect(await screen.findByText(/Product name is required\./i)).toBeInTheDocument()
    expect(adminProductApi.createProduct).not.toHaveBeenCalled()
  })
})


