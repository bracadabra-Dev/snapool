import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventEdit from './pages/EventEdit';
import ContributorPage from './pages/ContributorPage';
import Home from './pages/Home';
import Pricing from './pages/Pricing';

const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./admin/AdminDashboardPage'));
const AdminPlatformPage = lazy(() => import('./admin/AdminPlatformPage'));
const AdminPlansPage = lazy(() => import('./admin/AdminPlansPage'));
const AdminUsersPage = lazy(() =>
  import('./admin/AdminManagePages').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminEventsPage = lazy(() =>
  import('./admin/AdminManagePages').then((m) => ({ default: m.AdminEventsPage }))
);
const AdminPaymentsPage = lazy(() =>
  import('./admin/AdminManagePages').then((m) => ({ default: m.AdminPaymentsPage }))
);
const AdminAuditPage = lazy(() =>
  import('./admin/AdminManagePages').then((m) => ({ default: m.AdminAuditPage }))
);

function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/events/:id"
          element={
            <Protected>
              <EventEdit />
            </Protected>
          }
        />
        <Route path="/e/:slug" element={<ContributorPage />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div className="p-8 text-sm text-[var(--muted)]">Loading admin…</div>}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="platform" element={<AdminPlatformPage />} />
          <Route path="plans" element={<AdminPlansPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
