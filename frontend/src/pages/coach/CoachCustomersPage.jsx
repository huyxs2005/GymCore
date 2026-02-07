import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { coachNav } from '../../config/navigation'

function CoachCustomersPage() {
  return (
    <WorkspaceScaffold
      title="Coach Customers Workspace"
      subtitle="View assigned customers, training history, and feedback."
      links={coachNav}
    >
      <StarterPage
        title="Coach customer operations"
        subtitle="Use this module for customer profile, progress, notes, and feedback stats."
        endpoints={[
          'GET /api/v1/coach/customers',
          'GET /api/v1/coach/customers/{customerId}',
          'GET /api/v1/coach/customers/{customerId}/history',
          'PUT /api/v1/coach/customers/{customerId}/progress',
          'GET /api/v1/coach/feedback',
          'GET /api/v1/coach/feedback/average',
        ]}
        frontendFiles={[
          'src/pages/coach/CoachCustomersPage.jsx',
          'src/features/coach/api/coachCustomerApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/coach/controller/CoachBookingController.java',
          'src/main/java/com/gymcore/backend/modules/coach/service/CoachBookingService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CoachCustomersPage
