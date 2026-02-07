import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminPromotionsPage() {
  return (
    <WorkspaceScaffold
      title="Admin Promotions"
      subtitle="Manage coupon codes and promotion posts."
      links={adminNav}
    >
      <StarterPage
        title="Coupon + post administration"
        subtitle="Support coupon validity windows and one-time-per-user claim rule."
        endpoints={[
          'GET /api/v1/admin/promotions/coupons',
          'POST /api/v1/admin/promotions/coupons',
          'PUT /api/v1/admin/promotions/coupons/{promotionId}',
          'POST /api/v1/admin/promotions/posts',
          'PUT /api/v1/admin/promotions/posts/{postId}',
        ]}
        frontendFiles={['src/pages/admin/AdminPromotionsPage.jsx', 'src/features/promotion/api/adminPromotionApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java',
          'src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminPromotionsPage
