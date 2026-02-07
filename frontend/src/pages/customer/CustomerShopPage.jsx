import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { customerNav } from '../../config/navigation'

function CustomerShopPage() {
  return (
    <WorkspaceScaffold
      title="Customer Product Shop"
      subtitle="Implement product listing/detail, cart update, checkout, order history, and reviews."
      links={customerNav}
    >
      <StarterPage
        title="Product sales module"
        subtitle="Integrate cart + order + payment flow with claimed coupon usage."
        endpoints={[
          'GET /api/v1/products',
          'GET /api/v1/products/{id}',
          'GET /api/v1/cart',
          'POST /api/v1/cart/items',
          'PATCH /api/v1/cart/items/{productId}',
          'DELETE /api/v1/cart/items/{productId}',
          'POST /api/v1/orders/checkout',
          'GET /api/v1/orders/my-orders',
          'POST /api/v1/products/{id}/reviews',
        ]}
        frontendFiles={[
          'src/pages/customer/CustomerShopPage.jsx',
          'src/features/product/api/productApi.js',
          'src/features/product/api/cartApi.js',
          'src/features/product/api/orderApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/product/controller/ProductSalesController.java',
          'src/main/java/com/gymcore/backend/modules/product/service/ProductSalesService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerShopPage
