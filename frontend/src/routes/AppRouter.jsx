import { Navigate, Route, Routes } from 'react-router-dom'
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

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/forgot-password/reset" element={<ForgotPasswordResetPage />} />
      <Route path="/auth/change-password" element={<ChangePasswordPage />} />
      <Route path="/profile" element={<ProfilePage />} />

      <Route path="/customer/membership" element={<CustomerMembershipPage />} />
      <Route path="/customer/checkin-health" element={<CustomerCheckinHealthPage />} />
      <Route path="/customer/coach-booking" element={<CustomerCoachBookingPage />} />
      <Route path="/customer/shop" element={<CustomerShopPage />} />
      <Route path="/customer/promotions" element={<CustomerPromotionsPage />} />
      <Route path="/customer/knowledge" element={<CustomerKnowledgePage />} />

      <Route path="/coach/schedule" element={<CoachSchedulePage />} />
      <Route path="/coach/customers" element={<CoachCustomersPage />} />

      <Route path="/reception/checkin" element={<ReceptionCheckinPage />} />
      <Route path="/reception/customers" element={<ReceptionCustomersPage />} />

      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/admin/memberships" element={<AdminMembershipsPage />} />
      <Route path="/admin/coach-insights" element={<AdminCoachInsightsPage />} />
      <Route path="/admin/products" element={<AdminProductsPage />} />
      <Route path="/admin/promotions" element={<AdminPromotionsPage />} />
      <Route path="/admin/reports" element={<AdminReportsPage />} />

      <Route path="/workspace/customer/membership" element={<Navigate to="/customer/membership" replace />} />
      <Route path="/workspace/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter
