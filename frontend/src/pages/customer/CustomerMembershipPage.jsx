import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { customerNav } from '../../config/navigation'

function CustomerMembershipPage() {
  return (
    <WorkspaceScaffold
      title="Customer Membership"
      subtitle="Implement membership browsing, purchase, renewal, and current status."
      links={customerNav}
    >
      <StarterPage
        title="Membership + PayOS flow"
        subtitle="This module handles plan listing, plan detail, create payment link, webhook callback, and status."
        endpoints={[
          'GET /api/v1/memberships/plans',
          'GET /api/v1/memberships/plans/{id}',
          'GET /api/v1/memberships/current',
          'POST /api/v1/memberships/purchase',
          'POST /api/v1/memberships/renew',
          'POST /api/v1/memberships/upgrade',
          'POST /api/v1/payments/webhook',
        ]}
        frontendFiles={[
          'src/pages/customer/CustomerMembershipPage.jsx',
          'src/features/membership/api/membershipApi.js',
          'src/features/membership/hooks/useMembershipPlans.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/membership/controller/MembershipController.java',
          'src/main/java/com/gymcore/backend/modules/membership/service/MembershipService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerMembershipPage
