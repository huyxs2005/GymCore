import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminCoachInsightsPage() {
  return (
    <WorkspaceScaffold
      title="Admin Coach Insights"
      subtitle="View coach students and customer feedback across the platform."
      links={adminNav}
    >
      <StarterPage
        title="Coach oversight module"
        subtitle="Admin-only module for coach performance and customer satisfaction visibility."
        endpoints={['GET /api/v1/admin/coaches/students', 'GET /api/v1/admin/coaches/feedback']}
        frontendFiles={['src/pages/admin/AdminCoachInsightsPage.jsx', 'src/features/admin/api/adminApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/admin/controller/AdminController.java',
          'src/main/java/com/gymcore/backend/modules/admin/service/AdminService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminCoachInsightsPage
