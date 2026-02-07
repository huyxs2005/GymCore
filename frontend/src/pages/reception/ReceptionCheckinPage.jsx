import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { receptionNav } from '../../config/navigation'

function ReceptionCheckinPage() {
  return (
    <WorkspaceScaffold
      title="Reception Check-in Scanner"
      subtitle="Scan customer QR and validate active membership for check-in."
      links={receptionNav}
    >
      <StarterPage
        title="Reception check-in module"
        subtitle="Support scanner input and realtime membership validity verification."
        endpoints={[
          'POST /api/v1/reception/checkin/scan',
          'GET /api/v1/reception/checkin/{customerId}/validity',
          'GET /api/v1/reception/checkin/history',
        ]}
        frontendFiles={[
          'src/pages/reception/ReceptionCheckinPage.jsx',
          'src/features/checkin/api/receptionCheckinApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/checkin/controller/CheckinHealthController.java',
          'src/main/java/com/gymcore/backend/modules/checkin/service/CheckinHealthService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default ReceptionCheckinPage
