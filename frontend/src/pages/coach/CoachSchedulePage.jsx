import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { coachNav } from '../../config/navigation'

function CoachSchedulePage() {
  return (
    <WorkspaceScaffold
      title="Coach Schedule Workspace"
      subtitle="Manage weekly availability and view assigned PT sessions."
      links={coachNav}
    >
      <StarterPage
        title="Coach availability + schedule"
        subtitle="This module is for coach-side schedule operations."
        endpoints={[
          'GET /api/v1/coach/schedule',
          'PUT /api/v1/coach/availability',
          'GET /api/v1/coach/pt-sessions',
          'POST /api/v1/coach/pt-sessions/{id}/notes',
        ]}
        frontendFiles={[
          'src/pages/coach/CoachSchedulePage.jsx',
          'src/features/coach/api/coachApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/coach/controller/CoachBookingController.java',
          'src/main/java/com/gymcore/backend/modules/coach/service/CoachBookingService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CoachSchedulePage
