import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminDashboardPage() {
  return (
    <WorkspaceScaffold
      title="Admin Dashboard"
      subtitle="Revenue overview, active memberships, and platform health metrics."
      links={adminNav}
    >
      <StarterPage
        title="Admin summary and reporting"
        subtitle="Use this as the main overview page for all admin modules."
        endpoints={['GET /api/v1/admin/dashboard-summary', 'GET /api/v1/admin/revenue/overview']}
        frontendFiles={['src/pages/admin/AdminDashboardPage.jsx', 'src/features/admin/api/adminApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/admin/controller/AdminController.java',
          'src/main/java/com/gymcore/backend/modules/admin/service/AdminService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminDashboardPage
