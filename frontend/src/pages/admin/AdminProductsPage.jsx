import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminProductsPage() {
  return (
    <WorkspaceScaffold
      title="Admin Product Management"
      subtitle="Add/update products and review customer product ratings."
      links={adminNav}
    >
      <StarterPage
        title="Products + reviews admin"
        subtitle="Manage product catalog and monitor review quality."
        endpoints={[
          'GET /api/v1/admin/products',
          'POST /api/v1/admin/products',
          'PUT /api/v1/admin/products/{productId}',
          'GET /api/v1/admin/products/reviews',
        ]}
        frontendFiles={['src/pages/admin/AdminProductsPage.jsx', 'src/features/product/api/adminProductApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/product/controller/ProductSalesController.java',
          'src/main/java/com/gymcore/backend/modules/product/service/ProductSalesService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminProductsPage
