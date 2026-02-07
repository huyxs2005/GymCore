import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminUsersPage() {
  return (
    <WorkspaceScaffold
      title="Admin User Management"
      subtitle="Create staff account and lock/unlock users."
      links={adminNav}
    >
      <StarterPage
        title="Users and roles management"
        subtitle="Implement staff account provisioning and account status controls."
        endpoints={[
          'POST /api/v1/admin/users/staff',
          'PATCH /api/v1/admin/users/{userId}/lock',
          'PATCH /api/v1/admin/users/{userId}/unlock',
          'GET /api/v1/admin/users',
        ]}
        frontendFiles={['src/pages/admin/AdminUsersPage.jsx', 'src/features/users/api/adminUserApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/users/controller/UserManagementController.java',
          'src/main/java/com/gymcore/backend/modules/users/service/UserManagementService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminUsersPage
