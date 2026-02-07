import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { receptionNav } from '../../config/navigation'

function ReceptionCustomersPage() {
  return (
    <WorkspaceScaffold
      title="Reception Customer Lookup"
      subtitle="Search customer and quickly view current membership plan/status."
      links={receptionNav}
    >
      <StarterPage
        title="Reception customer tools"
        subtitle="Fast lookup workflow for front desk operations."
        endpoints={[
          'GET /api/v1/reception/customers/search',
          'GET /api/v1/reception/customers/{customerId}/membership',
        ]}
        frontendFiles={[
          'src/pages/reception/ReceptionCustomersPage.jsx',
          'src/features/users/api/receptionCustomerApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/users/controller/UserManagementController.java',
          'src/main/java/com/gymcore/backend/modules/users/service/UserManagementService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default ReceptionCustomersPage
