import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DealerWorkspaceShell from '../dashboard/DealerWorkspaceShell';
import { useAuth } from '../../contexts/AuthContextCore';

const AdminPage = lazy(() => import('../../pages/AdminPage'));
const AdminLoginPage = lazy(() => import('../../pages/AdminLoginPage'));
const DesignSystemPage = lazy(() => import('../../pages/DesignSystemPage'));
const AwaitingApprovalPage = lazy(() => import('../../pages/AwaitingApprovalPage'));
const DealerDashboardPage = lazy(() => import('../../pages/DealerDashboardPage'));
const DealerListingsPage = lazy(() => import('../../pages/DealerListingsPage'));
const DealerGuidePage = lazy(() => import('../../pages/DealerGuidePage'));
const MasterAdminGuidePage = lazy(() => import('../../pages/MasterAdminGuidePage'));
const AcceptInvitePage = lazy(() => import('../../pages/AcceptInvitePage'));
const LoginPage = lazy(() => import('../../pages/LoginPage'));
const RegisterUserPage = lazy(() => import('../../pages/RegisterUserPage'));
const RegisterDealerPage = lazy(() => import('../../pages/RegisterDealerPage'));
const FavoritesPage = lazy(() => import('../../pages/FavoritesPage'));

export type AuthRoutePage =
  | 'admin'
  | 'admin-login'
  | 'admin-guide'
  | 'admin-dealer-guide'
  | 'admin-design-system'
  | 'dealer-dashboard'
  | 'dealer-listings'
  | 'dealer-guide'
  | 'awaiting-approval'
  | 'accept-invite'
  | 'login'
  | 'register'
  | 'register-dealer'
  | 'favorites';

const LoadingScreen = () => (
  <div className="flex items-center justify-center py-24">
    <span className="text-gray-300">Loading...</span>
  </div>
);

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, role, loading, initializing } = useAuth();

  if (initializing || loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (role === 'pending') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

const DealerRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, role, loading: authLoading, initializing } = useAuth();

  if (initializing || authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'dealer') {
    return <Navigate to="/" replace />;
  }

  return children;
};

const renderPage = (page: AuthRoutePage) => {
  switch (page) {
    case 'admin-login':
      return <AdminLoginPage />;
    case 'login':
      return <LoginPage />;
    case 'register':
      return <RegisterUserPage />;
    case 'register-dealer':
      return <RegisterDealerPage />;
    case 'awaiting-approval':
      return <AwaitingApprovalPage />;
    case 'accept-invite':
      return <AcceptInvitePage />;
    case 'favorites':
      return <FavoritesPage />;
    case 'admin':
      return <AdminRoute><AdminPage /></AdminRoute>;
    case 'admin-guide':
      return <AdminRoute><MasterAdminGuidePage /></AdminRoute>;
    case 'admin-dealer-guide':
      return <AdminRoute><DealerGuidePage adminView /></AdminRoute>;
    case 'admin-design-system':
      return <AdminRoute><DesignSystemPage /></AdminRoute>;
    case 'dealer-listings':
      return (
        <DealerRoute>
          <DealerWorkspaceShell>
            <DealerListingsPage />
          </DealerWorkspaceShell>
        </DealerRoute>
      );
    case 'dealer-guide':
      return (
        <DealerRoute>
          <DealerWorkspaceShell>
            <DealerGuidePage />
          </DealerWorkspaceShell>
        </DealerRoute>
      );
    case 'dealer-dashboard':
      return (
        <DealerRoute>
          <DealerWorkspaceShell>
            <DealerDashboardPage />
          </DealerWorkspaceShell>
        </DealerRoute>
      );
    default:
      return <Navigate to="/" replace />;
  }
};

const AuthenticatedProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [providers, setProviders] = useState<{
    AuthProvider: React.ComponentType<{ children: React.ReactNode }>;
    DataProvider: React.ComponentType<{ children: React.ReactNode }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([import('../../contexts/AuthContext'), import('../../contexts/DataContext')]).then(
      ([authModule, dataModule]) => {
        if (!cancelled) {
          setProviders({
            AuthProvider: authModule.AuthProvider,
            DataProvider: dataModule.DataProvider,
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (!providers) {
    return <LoadingScreen />;
  }

  const { AuthProvider, DataProvider } = providers;
  return (
    <AuthProvider>
      <DataProvider>{children}</DataProvider>
    </AuthProvider>
  );
};

const AuthenticatedRouteContent: React.FC<{ page: AuthRoutePage }> = ({ page }) => (
  <AuthenticatedProviders>
    <Suspense fallback={<LoadingScreen />}>{renderPage(page)}</Suspense>
  </AuthenticatedProviders>
);

export default AuthenticatedRouteContent;
