import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { customerNav } from '../../config/navigation'

function CustomerPromotionsPage() {
  return (
    <WorkspaceScaffold
      title="Customer Promotions & Notifications"
      subtitle="Implement promotion posts, coupon claim wallet, coupon apply, and notification center."
      links={customerNav}
    >
      <StarterPage
        title="Promotion + wallet coupon module"
        subtitle="Follow claim-first rule: customer must claim before applying coupon on payment."
        endpoints={[
          'GET /api/v1/promotions/posts',
          'POST /api/v1/promotions/claims',
          'POST /api/v1/promotions/apply',
          'GET /api/v1/promotions/my-claims',
          'GET /api/v1/notifications',
          'PATCH /api/v1/notifications/{id}/read',
        ]}
        frontendFiles={[
          'src/pages/customer/CustomerPromotionsPage.jsx',
          'src/features/promotion/api/promotionApi.js',
          'src/features/notification/api/notificationApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java',
          'src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerPromotionsPage
