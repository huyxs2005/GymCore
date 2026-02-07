import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { customerNav } from '../../config/navigation'

function CustomerCheckinHealthPage() {
  return (
    <WorkspaceScaffold
      title="Customer Check-in & Health"
      subtitle="Implement QR check-in display/history and health tracking (height, weight, BMI)."
      links={customerNav}
    >
      <StarterPage
        title="Check-in and Health profile"
        subtitle="Connect QR token, check-in history, and health history/current endpoints."
        endpoints={[
          'GET /api/v1/checkin/qr',
          'GET /api/v1/checkin/history',
          'GET /api/v1/health/current',
          'GET /api/v1/health/history',
          'GET /api/v1/health/coach-notes',
          'POST /api/v1/health/records',
        ]}
        frontendFiles={[
          'src/pages/customer/CustomerCheckinHealthPage.jsx',
          'src/features/checkin/api/checkinApi.js',
          'src/features/health/api/healthApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/checkin/controller/CheckinHealthController.java',
          'src/main/java/com/gymcore/backend/modules/checkin/service/CheckinHealthService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerCheckinHealthPage
