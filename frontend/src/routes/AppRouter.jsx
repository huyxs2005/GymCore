import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from '../features/auth/useSession'
import LandingPage from '../pages/public/LandingPage'
import LoginPage from '../pages/public/LoginPage'
import RegisterPage from '../pages/public/RegisterPage'
import ForgotPasswordPage from '../pages/public/ForgotPasswordPage'
import ForgotPasswordResetPage from '../pages/public/ForgotPasswordResetPage'
import ChangePasswordPage from '../pages/public/ChangePasswordPage'
import ProfilePage from '../pages/common/ProfilePage'
import CustomerMembershipPage from '../pages/customer/CustomerMembershipPage'
import CustomerCheckinHealthPage from '../pages/customer/CustomerCheckinHealthPage'
import CustomerCoachBookingPage from '../pages/customer/CustomerCoachBookingPage'
import CustomerShopPage from '../pages/customer/CustomerShopPage'
import CustomerPromotionsPage from '../pages/customer/CustomerPromotionsPage'
import CustomerKnowledgePage from '../pages/customer/CustomerKnowledgePage'
import CoachSchedulePage from '../pages/coach/CoachSchedulePage'
import CoachCustomersPage from '../pages/coach/CoachCustomersPage'
import ReceptionCheckinPage from '../pages/reception/ReceptionCheckinPage'
import ReceptionCustomersPage from '../pages/reception/ReceptionCustomersPage'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import AdminUsersPage from '../pages/admin/AdminUsersPage'
import AdminMembershipsPage from '../pages/admin/AdminMembershipsPage'
import AdminCoachInsightsPage from '../pages/admin/AdminCoachInsightsPage'
import AdminProductsPage from '../pages/admin/AdminProductsPage'
import AdminPromotionsPage from '../pages/admin/AdminPromotionsPage'
import AdminReportsPage from '../pages/admin/AdminReportsPage'
import NotFoundPage from '../pages/NotFoundPage'

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
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/forgot-password/reset" element={<ForgotPasswordResetPage />} />
      <Route path="/auth/change-password" element={withAuth(<ChangePasswordPage />)} />
      <Route path="/profile" element={withAuth(<ProfilePage />)} />

      <Route path="/customer/membership" element={withRole(['CUSTOMER'], <CustomerMembershipPage />)} />
      <Route path="/customer/checkin-health" element={withRole(['CUSTOMER'], <CustomerCheckinHealthPage />)} />
      <Route path="/customer/coach-booking" element={withRole(['CUSTOMER'], <CustomerCoachBookingPage />)} />
      <Route path="/customer/shop" element={withRole(['CUSTOMER'], <CustomerShopPage />)} />
      <Route path="/customer/promotions" element={withRole(['CUSTOMER'], <CustomerPromotionsPage />)} />
      <Route path="/customer/knowledge" element={withRole(['CUSTOMER'], <CustomerKnowledgePage />)} />

      <Route path="/coach/schedule" element={withRole(['COACH'], <CoachSchedulePage />)} />
      <Route path="/coach/customers" element={withRole(['COACH'], <CoachCustomersPage />)} />

      <Route path="/reception/checkin" element={withRole(['RECEPTIONIST'], <ReceptionCheckinPage />)} />
      <Route path="/reception/customers" element={withRole(['RECEPTIONIST'], <ReceptionCustomersPage />)} />

      <Route path="/admin/dashboard" element={withRole(['ADMIN'], <AdminDashboardPage />)} />
      <Route path="/admin/users" element={withRole(['ADMIN'], <AdminUsersPage />)} />
      <Route path="/admin/memberships" element={withRole(['ADMIN'], <AdminMembershipsPage />)} />
      <Route path="/admin/coach-insights" element={withRole(['ADMIN'], <AdminCoachInsightsPage />)} />
      <Route path="/admin/products" element={withRole(['ADMIN'], <AdminProductsPage />)} />
      <Route path="/admin/promotions" element={withRole(['ADMIN'], <AdminPromotionsPage />)} />
      <Route path="/admin/reports" element={withRole(['ADMIN'], <AdminReportsPage />)} />

      <Route path="/workspace/customer/membership" element={<Navigate to="/customer/membership" replace />} />
      <Route path="/workspace/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter
