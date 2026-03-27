import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from '../features/auth/useSession'
import { GLOBAL_MUTATION_SYNC_EVENT } from '../features/dataSync/mutationSync'

const LandingPage = lazy(() => import('../pages/public/LandingPage'))
const LoginPage = lazy(() => import('../pages/public/LoginPage'))
const RegisterPage = lazy(() => import('../pages/public/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/public/ForgotPasswordPage'))
const ForgotPasswordResetPage = lazy(() => import('../pages/public/ForgotPasswordResetPage'))
const ChangePasswordPage = lazy(() => import('../pages/public/ChangePasswordPage'))
const ProfilePage = lazy(() => import('../pages/common/ProfilePage'))
const NotificationsPage = lazy(() => import('../pages/common/NotificationsPage'))
const CustomerMembershipPage = lazy(() => import('../pages/customer/CustomerMembershipPage'))
const CustomerMembershipCheckoutPage = lazy(() => import('../pages/customer/CustomerMembershipCheckoutPage'))
const CustomerCurrentMembershipPage = lazy(() => import('../pages/customer/CustomerCurrentMembershipPage'))
const CustomerProgressHubPage = lazy(() => import('../pages/customer/CustomerProgressHubPage'))
const CustomerCheckinHealthPage = lazy(() => import('../pages/customer/CustomerCheckinHealthPage'))
const CustomerCoachBookingPage = lazy(() => import('../pages/customer/CustomerCoachBookingPage'))
const CustomerShopPage = lazy(() => import('../pages/customer/CustomerShopPage'))
const CustomerCartPage = lazy(() => import('../pages/customer/CustomerCartPage'))
const CustomerProductDetailPage = lazy(() => import('../pages/customer/CustomerProductDetailPage'))
const CustomerOrderHistoryPage = lazy(() => import('../pages/customer/CustomerOrderHistoryPage'))
const CustomerPromotionsPage = lazy(() => import('../pages/customer/CustomerPromotionsPage'))
const CustomerKnowledgePage = lazy(() => import('../pages/customer/CustomerKnowledgePage'))
const CoachSchedulePage = lazy(() => import('../pages/coach/CoachSchedulePage'))
const CoachCustomersPage = lazy(() => import('../pages/coach/CoachCustomersPage'))
const ReceptionCheckinPage = lazy(() => import('../pages/reception/ReceptionCheckinPage'))
const ReceptionCustomersPage = lazy(() => import('../pages/reception/ReceptionCustomersPage'))
const ReceptionPickupPage = lazy(() => import('../pages/reception/ReceptionPickupPage'))
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'))
const AdminSupportConsolePage = lazy(() => import('../pages/admin/AdminSupportConsolePage'))
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'))
const AdminMembershipsPage = lazy(() => import('../pages/admin/AdminMembershipsPage'))
const AdminCoachManagementPage = lazy(() => import('../pages/admin/AdminCoachManagementPage'))
const CoachBookingManagementPage = lazy(() => import('../pages/coach/CoachBookingManagementPage'))
const AdminProductsPage = lazy(() => import('../pages/admin/AdminProductsPage'))
const AdminGoalsPage = lazy(() => import('../pages/admin/AdminGoalsPage'))
const AdminWorkoutsPage = lazy(() => import('../pages/admin/AdminWorkoutsPage'))
const AdminFoodsPage = lazy(() => import('../pages/admin/AdminFoodsPage'))
const AdminCoachInsightsPage = lazy(() => import('../pages/admin/AdminCoachInsightsPage'))
const AdminInvoicesPage = lazy(() => import('../pages/admin/AdminInvoicesPage'))
const AdminPromotionsPage = lazy(() => import('../pages/admin/AdminPromotionsPage'))
const AdminReportsPage = lazy(() => import('../pages/admin/AdminReportsPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gym-500 border-t-transparent" />
        Loading page...
      </div>
    </div>
  )
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useSession()
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return children
}

function RequireRole({ roles, children }) {
  const { isAuthenticated, user } = useSession()
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }
  const role = String(user?.role || '').toUpperCase()
  if (!roles.includes(role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function AppRouter() {
  const location = useLocation()
  const [mutationVersion, setMutationVersion] = useState(0)
  const withAuth = (element) => <RequireAuth>{element}</RequireAuth>
  const withRole = (roles, element) => <RequireRole roles={roles}>{element}</RequireRole>

  useEffect(() => {
    const handleMutationSync = () => {
      setMutationVersion((prev) => prev + 1)
    }

    const handleStorageSync = (event) => {
      if (event.key === 'gymcore:mutation-sync') {
        setMutationVersion((prev) => prev + 1)
      }
    }

    window.addEventListener(GLOBAL_MUTATION_SYNC_EVENT, handleMutationSync)
    window.addEventListener('storage', handleStorageSync)

    return () => {
      window.removeEventListener(GLOBAL_MUTATION_SYNC_EVENT, handleMutationSync)
      window.removeEventListener('storage', handleStorageSync)
    }
  }, [])

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes key={`${location.pathname}|${location.search}|${mutationVersion}`}>
        <Route path="/" element={<LandingPage />} />

        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/forgot-password/reset" element={<ForgotPasswordResetPage />} />
        <Route path="/auth/change-password" element={withAuth(<ChangePasswordPage />)} />
        <Route path="/profile" element={withAuth(<ProfilePage />)} />
        <Route path="/notifications" element={withAuth(<NotificationsPage />)} />

        <Route path="/customer/membership" element={withRole(['CUSTOMER'], <CustomerMembershipPage />)} />
        <Route path="/customer/membership/checkout" element={withRole(['CUSTOMER'], <CustomerMembershipCheckoutPage />)} />
        <Route path="/customer/current-membership" element={withRole(['CUSTOMER'], <CustomerCurrentMembershipPage />)} />
        <Route path="/customer/progress-hub" element={withRole(['CUSTOMER'], <CustomerProgressHubPage />)} />
        <Route path="/customer/checkin-health" element={withRole(['CUSTOMER'], <CustomerCheckinHealthPage />)} />
        <Route path="/customer/coach-booking" element={withRole(['CUSTOMER'], <CustomerCoachBookingPage />)} />
        <Route path="/customer/shop" element={withRole(['CUSTOMER'], <CustomerShopPage />)} />
        <Route path="/customer/cart" element={withRole(['CUSTOMER'], <CustomerCartPage />)} />
        <Route path="/customer/shop/:productId" element={withRole(['CUSTOMER'], <CustomerProductDetailPage />)} />
        <Route path="/customer/orders" element={withRole(['CUSTOMER'], <CustomerOrderHistoryPage />)} />
        <Route path="/customer/promotions" element={withRole(['CUSTOMER'], <CustomerPromotionsPage />)} />
        <Route path="/customer/knowledge" element={withRole(['CUSTOMER'], <CustomerKnowledgePage />)} />

        <Route path="/coach/schedule" element={withRole(['COACH'], <CoachSchedulePage />)} />
        <Route path="/coach/booking-requests" element={withRole(['COACH'], <CoachBookingManagementPage />)} />
        <Route path="/coach/customers" element={withRole(['COACH'], <CoachCustomersPage />)} />

        <Route path="/reception/checkin" element={withRole(['RECEPTIONIST'], <ReceptionCheckinPage />)} />
        <Route path="/reception/customers" element={withRole(['RECEPTIONIST'], <ReceptionCustomersPage />)} />
        <Route path="/reception/pickup" element={withRole(['RECEPTIONIST'], <ReceptionPickupPage />)} />
        <Route path="/reception/invoices" element={withRole(['RECEPTIONIST'], <AdminInvoicesPage />)} />

        <Route path="/admin/dashboard" element={withRole(['ADMIN'], <AdminDashboardPage />)} />
        <Route path="/admin/support" element={withRole(['ADMIN'], <AdminSupportConsolePage />)} />
        <Route path="/admin/users" element={withRole(['ADMIN'], <AdminUsersPage />)} />
        <Route path="/admin/memberships" element={withRole(['ADMIN'], <AdminMembershipsPage />)} />
        <Route path="/admin/coach-management" element={withRole(['ADMIN'], <AdminCoachManagementPage />)} />
        <Route path="/admin/products" element={withRole(['ADMIN'], <AdminProductsPage />)} />
        <Route path="/admin/goals" element={withRole(['ADMIN'], <AdminGoalsPage />)} />
        <Route path="/admin/workouts" element={withRole(['ADMIN'], <AdminWorkoutsPage />)} />
        <Route path="/admin/foods" element={withRole(['ADMIN'], <AdminFoodsPage />)} />
        <Route path="/admin/coach-insights" element={withRole(['ADMIN'], <AdminCoachInsightsPage />)} />
        <Route path="/admin/invoices" element={withRole(['ADMIN'], <AdminInvoicesPage />)} />
        <Route path="/admin/promotions" element={withRole(['ADMIN'], <AdminPromotionsPage />)} />
        <Route path="/admin/reports" element={withRole(['ADMIN'], <AdminReportsPage />)} />

        <Route path="/workspace/customer/membership" element={<Navigate to="/customer/membership" replace />} />
        <Route path="/workspace/customer/progress-hub" element={<Navigate to="/customer/progress-hub" replace />} />
        <Route path="/workspace/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter
