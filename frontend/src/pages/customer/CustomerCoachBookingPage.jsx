import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { customerNav } from '../../config/navigation'

function CustomerCoachBookingPage() {
  return (
    <WorkspaceScaffold
      title="Customer Coach Booking"
      subtitle="Implement coach matching, recurring PT request, schedule, cancellation/reschedule, and feedback."
      links={customerNav}
    >
      <StarterPage
        title="Coach booking domain"
        subtitle="Build PT recurring request + session schedule flows with membership validation."
        endpoints={[
          'POST /api/v1/coach-booking/match',
          'GET /api/v1/coaches',
          'GET /api/v1/coaches/{id}',
          'GET /api/v1/coaches/{id}/schedule',
          'POST /api/v1/coach-booking/requests',
          'GET /api/v1/coach-booking/my-schedule',
          'PATCH /api/v1/coach-booking/sessions/{id}/cancel',
          'PATCH /api/v1/coach-booking/sessions/{id}/reschedule',
          'POST /api/v1/coach-booking/feedback',
        ]}
        frontendFiles={[
          'src/pages/customer/CustomerCoachBookingPage.jsx',
          'src/features/coach/api/coachApi.js',
          'src/features/coach/api/coachBookingApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/coach/controller/CoachBookingController.java',
          'src/main/java/com/gymcore/backend/modules/coach/service/CoachBookingService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerCoachBookingPage
