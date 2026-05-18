import React, { Suspense, lazy, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTopButton from './components/ScrollToTopButton';
import DealerWorkspaceShell from './components/dashboard/DealerWorkspaceShell';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataContext, DataProvider } from './contexts/DataContext';
import { ToastProvider, ToastContainer } from './contexts/ToastContext';
import { PublicAnnouncementsProvider } from './contexts/PublicAnnouncementsContext';
import PublicAnnouncementSurface from './components/announcements/PublicAnnouncementSurface';
import ScrollRestoration from './components/ScrollRestoration';
import LocalePathSync from './components/LocalePathSync';
import LocalizedNavigate from './components/LocalizedNavigate';
import {
  ALTERNATE_LOCALES,
  buildLocalizedRoutePath,
  stripLocalePrefix,
} from './utils/localizedRouting';

const HomePage = lazy(() => import('./pages/HomePage'));
const DealersListPage = lazy(() => import('./pages/DealersListPage'));
const DealerDetailPage = lazy(() => import('./pages/DealerDetailPage'));
const ModelsListPage = lazy(() => import('./pages/ModelsListPage'));
const ModelDetailPage = lazy(() => import('./pages/ModelDetailPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const ChargingStationsAlbaniaPage = lazy(() => import('./pages/ChargingStationsAlbaniaPage'));
const RegisterUserPage = lazy(() => import('./pages/RegisterUserPage'));
const RegisterDealerPage = lazy(() => import('./pages/RegisterDealerPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
const AwaitingApprovalPage = lazy(() => import('./pages/AwaitingApprovalPage'));
const DealerDashboardPage = lazy(() => import('./pages/DealerDashboardPage'));
const DealerListingsPage = lazy(() => import('./pages/DealerListingsPage'));
const DealerGuidePage = lazy(() => import('./pages/DealerGuidePage'));
const MasterAdminGuidePage = lazy(() => import('./pages/MasterAdminGuidePage'));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage'));
const ListingsPage = lazy(() => import('./pages/ListingsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SitemapPage = lazy(() => import('./pages/SitemapPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const CookiesPolicyPage = lazy(() => import('./pages/CookiesPolicyPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));

const PUBLIC_ROUTE_DEFINITIONS: Array<{ path: string; element: React.ReactElement }> = [
  { path: '/', element: <HomePage /> },
  { path: '/dealers', element: <DealersListPage /> },
  { path: '/dealers/:id', element: <DealerDetailPage /> },
  { path: '/albania-charging-stations', element: <ChargingStationsAlbaniaPage /> },
  { path: '/models', element: <ModelsListPage /> },
  { path: '/models/:id', element: <ModelDetailPage /> },
  { path: '/listings', element: <ListingsPage /> },
  { path: '/listings/:id', element: <ListingDetailPage /> },
  { path: '/blog', element: <BlogPage /> },
  { path: '/blog/:slug', element: <BlogPostPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/help-center', element: <HelpCenterPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/favorites', element: <FavoritesPage /> },
  { path: '/awaiting-approval', element: <AwaitingApprovalPage /> },
  { path: '/accept-invite', element: <AcceptInvitePage /> },
  { path: '/register', element: <RegisterUserPage /> },
  { path: '/register-dealer', element: <RegisterDealerPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/sitemap', element: <SitemapPage /> },
  { path: '/privacy-policy', element: <PrivacyPolicyPage /> },
  { path: '/terms', element: <TermsOfServicePage /> },
  { path: '/cookie-policy', element: <CookiesPolicyPage /> },
];

const PUBLIC_ROUTE_LOCALES = [undefined, ...ALTERNATE_LOCALES] as const;

const LoadingScreen = () => (
  <div className="flex items-center justify-center py-24">
    <span className="text-gray-300">Loading...</span>
  </div>
);

const RouteContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
);

const isFocusedWorkspaceRoute = (pathname: string) => {
  const normalizedPath = stripLocalePrefix(pathname).pathname;
  return (
    normalizedPath === '/admin' ||
    normalizedPath.startsWith('/admin/') ||
    normalizedPath === '/dealer' ||
    normalizedPath.startsWith('/dealer/')
  );
};

const LegacyDefaultLocaleRedirect: React.FC = () => {
  const location = useLocation();
  const normalizedPath = stripLocalePrefix(location.pathname).pathname;

  return <Navigate to={`${normalizedPath}${location.search}${location.hash}`} replace />;
};

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
  const { user, role, profile, loading: authLoading, initializing } = useAuth();
  const { dealers, loading: dataLoading } = useContext(DataContext);

  const dealerRecord = useMemo(() => {
    if (!user) {
      return null;
    }
    const dealerStaffDealerId =
      profile?.accountType === 'dealer_staff' && typeof profile.dealerId === 'string'
        ? profile.dealerId
        : null;
    return (
      dealers.find(
        dealer =>
          dealer.id === user.uid ||
          dealer.ownerUid === user.uid ||
          (dealerStaffDealerId ? dealer.id === dealerStaffDealerId : false),
      ) ?? null
    );
  }, [dealers, profile, user]);

  if (initializing || authLoading || dataLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'dealer') {
    return <Navigate to="/" replace />;
  }

  const dealerStatus = dealerRecord?.status ?? (dealerRecord?.approved === false ? 'pending' : 'approved');
  const dealerIsActive =
    dealerRecord && dealerRecord.isDeleted !== true && dealerRecord.isActive !== false && dealerStatus === 'approved';

  if (!dealerRecord || !dealerIsActive) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/sq" element={<LegacyDefaultLocaleRedirect />} />
    <Route path="/sq/*" element={<LegacyDefaultLocaleRedirect />} />
    {PUBLIC_ROUTE_LOCALES.map(locale =>
      PUBLIC_ROUTE_DEFINITIONS.map(route => (
        <React.Fragment key={`${locale ?? 'sq'}:${route.path}`}>
          <Route
            path={buildLocalizedRoutePath(route.path, locale)}
            element={<RouteContent>{route.element}</RouteContent>}
          />
        </React.Fragment>
      ))
    )}
    {PUBLIC_ROUTE_LOCALES.map(locale => (
      <React.Fragment key={`${locale ?? 'sq'}:/privacy`}>
        <Route
          path={buildLocalizedRoutePath('/privacy', locale)}
          element={<LocalizedNavigate to="/privacy-policy" replace />}
        />
      </React.Fragment>
    ))}
    {PUBLIC_ROUTE_LOCALES.map(locale => (
      <React.Fragment key={`${locale ?? 'sq'}:/cookies`}>
        <Route
          path={buildLocalizedRoutePath('/cookies', locale)}
          element={<LocalizedNavigate to="/cookie-policy" replace />}
        />
      </React.Fragment>
    ))}
    <Route path="/admin/login" element={<RouteContent><AdminLoginPage /></RouteContent>} />
    <Route
      path="/dealer/listings"
      element={
        <RouteContent>
          <DealerRoute>
            <DealerWorkspaceShell>
              <DealerListingsPage />
            </DealerWorkspaceShell>
          </DealerRoute>
        </RouteContent>
      }
    />
    <Route
      path="/dealer/guide"
      element={(
        <RouteContent>
          <DealerRoute>
            <DealerWorkspaceShell>
              <DealerGuidePage />
            </DealerWorkspaceShell>
          </DealerRoute>
        </RouteContent>
      )}
    />
    <Route
      path="/dealer/dashboard"
      element={(
        <RouteContent>
          <DealerRoute>
            <DealerWorkspaceShell>
              <DealerDashboardPage />
            </DealerWorkspaceShell>
          </DealerRoute>
        </RouteContent>
      )}
    />
    <Route
      path="/admin/guide"
      element={(
        <RouteContent>
          <AdminRoute>
            <MasterAdminGuidePage />
          </AdminRoute>
        </RouteContent>
      )}
    />
    <Route
      path="/admin/dealer-guide"
      element={(
        <RouteContent>
          <AdminRoute>
            <DealerGuidePage adminView />
          </AdminRoute>
        </RouteContent>
      )}
    />
    <Route
      path="/admin/design-system"
      element={(
        <RouteContent>
          <AdminRoute>
            <DesignSystemPage />
          </AdminRoute>
        </RouteContent>
      )}
    />
    <Route
      path="/admin"
      element={(
        <RouteContent>
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        </RouteContent>
      )}
    />
  </Routes>
);

const AppShell = () => {
  const location = useLocation();
  const isFocusedWorkspace = isFocusedWorkspaceRoute(location.pathname);

  return (
    <div className={isFocusedWorkspace ? 'min-h-screen' : 'flex min-h-screen flex-col'}>
      <PublicAnnouncementsProvider disabled={isFocusedWorkspace}>
        {!isFocusedWorkspace && <Header />}
        {!isFocusedWorkspace && <PublicAnnouncementSurface />}
        {isFocusedWorkspace ? (
          <AppRoutes />
        ) : (
          <main className="flex-grow">
            <AppRoutes />
          </main>
        )}
        {!isFocusedWorkspace && <Footer />}
        {!isFocusedWorkspace && <ScrollToTopButton />}
        <ToastContainer />
      </PublicAnnouncementsProvider>
    </div>
  );
};

const App: React.FC = () => {

  return (
    <BrowserRouter>
      <LocalePathSync />
      <ScrollRestoration />
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <AppShell />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
