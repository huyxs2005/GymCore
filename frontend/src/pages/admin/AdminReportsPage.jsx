import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminReportsPage() {
  return (
    <WorkspaceScaffold
      title="Admin Reports"
      subtitle="Revenue reporting and export endpoints."
      links={adminNav}
    >
      <StarterPage
        title="Reporting module"
        subtitle="Provide revenue trend, segment breakdown, and PDF export."
        endpoints={[
          'GET /api/v1/admin/reports/revenue?from&to',
          'GET /api/v1/admin/reports/revenue/products?from&to',
          'GET /api/v1/admin/reports/revenue/memberships?from&to',
          'GET /api/v1/admin/coaches/students',
          'GET /api/v1/admin/coaches/feedback',
          'POST /api/v1/admin/reports/export-pdf',
        ]}
        frontendFiles={['src/pages/admin/AdminReportsPage.jsx', 'src/features/admin/api/reportApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/admin/controller/AdminController.java',
          'src/main/java/com/gymcore/backend/modules/admin/service/AdminService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminReportsPage
