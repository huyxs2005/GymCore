import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { customerNav } from '../../config/navigation'

function CustomerKnowledgePage() {
  return (
    <WorkspaceScaffold
      title="Customer Workout/Food/AI"
      subtitle="Implement content browsing (workouts, foods) and AI recommendation integration."
      links={customerNav}
    >
      <StarterPage
        title="Knowledge & AI module"
        subtitle="AI bot scope is recommendations for workouts + foods only."
        endpoints={[
          'GET /api/v1/workouts/categories',
          'GET /api/v1/workouts',
          'GET /api/v1/workouts/{id}',
          'GET /api/v1/foods/categories',
          'GET /api/v1/foods',
          'GET /api/v1/foods/{id}',
          'POST /api/v1/ai/recommendations',
        ]}
        frontendFiles={[
          'src/pages/customer/CustomerKnowledgePage.jsx',
          'src/features/content/api/workoutApi.js',
          'src/features/content/api/foodApi.js',
          'src/features/content/api/aiApi.js',
        ]}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/content/controller/ContentController.java',
          'src/main/java/com/gymcore/backend/modules/content/service/ContentService.java',
        ]}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerKnowledgePage
