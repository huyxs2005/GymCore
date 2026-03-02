import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from '../features/auth/useSession'

const LandingPage = lazy(() => import('../pages/public/LandingPage'))
const LoginPage = lazy(() => import('../pages/public/LoginPage'))
const RegisterPage = lazy(() => import('../pages/public/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/public/ForgotPasswordPage'))
const ForgotPasswordResetPage = lazy(() => import('../pages/public/ForgotPasswordResetPage'))
const ChangePasswordPage = lazy(() => import('../pages/public/ChangePasswordPage'))
const ProfilePage = lazy(() => import('../pages/common/ProfilePage'))
const CustomerMembershipPage = lazy(() => import('../pages/customer/CustomerMembershipPage'))
const CustomerCurrentMembershipPage = lazy(() => import('../pages/customer/CustomerCurrentMembershipPage'))
const CustomerCheckinHealthPage = lazy(() => import('../pages/customer/CustomerCheckinHealthPage'))
const CustomerCoachBookingPage = lazy(() => import('../pages/customer/CustomerCoachBookingPage'))
const CustomerShopPage = lazy(() => import('../pages/customer/CustomerShopPage'))
const CustomerPromotionsPage = lazy(() => import('../pages/customer/CustomerPromotionsPage'))
const CustomerKnowledgePage = lazy(() => import('../pages/customer/CustomerKnowledgePage'))
const CoachSchedulePage = lazy(() => import('../pages/coach/CoachSchedulePage'))
const CoachCustomersPage = lazy(() => import('../pages/coach/CoachCustomersPage'))
const ReceptionCheckinPage = lazy(() => import('../pages/reception/ReceptionCheckinPage'))
const ReceptionCustomersPage = lazy(() => import('../pages/reception/ReceptionCustomersPage'))
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'))
const AdminMembershipsPage = lazy(() => import('../pages/admin/AdminMembershipsPage'))
const AdminCoachManagementPage = lazy(() => import('../pages/admin/AdminCoachManagementPage'))
const CoachBookingManagementPage = lazy(() => import('../pages/coach/CoachBookingManagementPage'))
const AdminProductsPage = lazy(() => import('../pages/admin/AdminProductsPage'))
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
  const withAuth = (element) => <RequireAuth>{element}</RequireAuth>
  const withRole = (roles, element) => <RequireRole roles={roles}>{element}</RequireRole>

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/forgot-password/reset" element={<ForgotPasswordResetPage />} />
        <Route path="/auth/change-password" element={withAuth(<ChangePasswordPage />)} />
        <Route path="/profile" element={withAuth(<ProfilePage />)} />

        <Route path="/customer/membership" element={withRole(['CUSTOMER'], <CustomerMembershipPage />)} />
        <Route path="/customer/current-membership" element={withRole(['CUSTOMER'], <CustomerCurrentMembershipPage />)} />
        <Route path="/customer/checkin-health" element={withRole(['CUSTOMER'], <CustomerCheckinHealthPage />)} />
        <Route path="/customer/coach-booking" element={withRole(['CUSTOMER'], <CustomerCoachBookingPage />)} />
        <Route path="/customer/shop" element={withRole(['CUSTOMER'], <CustomerShopPage />)} />
        <Route path="/customer/promotions" element={withRole(['CUSTOMER'], <CustomerPromotionsPage />)} />
        <Route path="/customer/knowledge" element={withRole(['CUSTOMER'], <CustomerKnowledgePage />)} />

        <Route path="/coach/schedule" element={withRole(['COACH'], <CoachSchedulePage />)} />
        <Route path="/coach/booking-requests" element={withRole(['COACH'], <CoachBookingManagementPage />)} />
        <Route path="/coach/customers" element={withRole(['COACH'], <CoachCustomersPage />)} />

        <Route path="/reception/checkin" element={withRole(['RECEPTIONIST'], <ReceptionCheckinPage />)} />
        <Route path="/reception/customers" element={withRole(['RECEPTIONIST'], <ReceptionCustomersPage />)} />

        <Route path="/admin/dashboard" element={withRole(['ADMIN'], <AdminDashboardPage />)} />
        <Route path="/admin/users" element={withRole(['ADMIN'], <AdminUsersPage />)} />
        <Route path="/admin/memberships" element={withRole(['ADMIN'], <AdminMembershipsPage />)} />
        <Route path="/admin/coach-management" element={withRole(['ADMIN'], <AdminCoachManagementPage />)} />
        <Route path="/admin/products" element={withRole(['ADMIN'], <AdminProductsPage />)} />
        <Route path="/admin/promotions" element={withRole(['ADMIN'], <AdminPromotionsPage />)} />
        <Route path="/admin/reports" element={withRole(['ADMIN'], <AdminReportsPage />)} />

        <Route path="/workspace/customer/membership" element={<Navigate to="/customer/membership" replace />} />
        <Route path="/workspace/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default AppRouter
