import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'

function AdminMembershipsPage() {
  return (
    <WorkspaceScaffold
      title="Admin Membership Plans"
      subtitle="Create and update membership plans."
      links={adminNav}
    >
      <StarterPage
        title="Membership plan administration"
        subtitle="Ensure plan type rules are respected (GYM_ONLY, DAY_PASS, GYM_PLUS_COACH)."
        endpoints={[
          'GET /api/v1/admin/membership-plans',
          'POST /api/v1/admin/membership-plans',
          'PUT /api/v1/admin/membership-plans/{planId}',
        ]}
        frontendFiles={['src/pages/admin/AdminMembershipsPage.jsx', 'src/features/membership/api/adminMembershipApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/membership/controller/MembershipController.java',
          'src/main/java/com/gymcore/backend/modules/membership/service/MembershipService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default AdminMembershipsPage
