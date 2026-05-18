import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTopButton from './components/ScrollToTopButton';
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
import type { AuthRoutePage } from './components/auth/AuthenticatedRouteContent';

const HomePage = lazy(() => import('./pages/HomePage'));
const DealersListPage = lazy(() => import('./pages/DealersListPage'));
const DealerDetailPage = lazy(() => import('./pages/DealerDetailPage'));
const ModelsListPage = lazy(() => import('./pages/ModelsListPage'));
const ModelDetailPage = lazy(() => import('./pages/ModelDetailPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ChargingStationsAlbaniaPage = lazy(() => import('./pages/ChargingStationsAlbaniaPage'));
const ListingsPage = lazy(() => import('./pages/ListingsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const SitemapPage = lazy(() => import('./pages/SitemapPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const CookiesPolicyPage = lazy(() => import('./pages/CookiesPolicyPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));
const AuthenticatedRouteContent = lazy(() => import('./components/auth/AuthenticatedRouteContent'));

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

const AuthRoute: React.FC<{ page: AuthRoutePage }> = ({ page }) => (
  <RouteContent>
    <AuthenticatedRouteContent page={page} />
  </RouteContent>
);

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
    <Route path="/admin/login" element={<AuthRoute page="admin-login" />} />
    <Route path="/login" element={<AuthRoute page="login" />} />
    <Route path="/register" element={<AuthRoute page="register" />} />
    <Route path="/register-dealer" element={<AuthRoute page="register-dealer" />} />
    <Route path="/awaiting-approval" element={<AuthRoute page="awaiting-approval" />} />
    <Route path="/accept-invite" element={<AuthRoute page="accept-invite" />} />
    <Route path="/favorites" element={<AuthRoute page="favorites" />} />
    <Route
      path="/dealer/listings"
      element={
        <AuthRoute page="dealer-listings" />
      }
    />
    <Route
      path="/dealer/guide"
      element={(
        <AuthRoute page="dealer-guide" />
      )}
    />
    <Route
      path="/dealer/dashboard"
      element={(
        <AuthRoute page="dealer-dashboard" />
      )}
    />
    <Route
      path="/admin/guide"
      element={(
        <AuthRoute page="admin-guide" />
      )}
    />
    <Route
      path="/admin/dealer-guide"
      element={(
        <AuthRoute page="admin-dealer-guide" />
      )}
    />
    <Route
      path="/admin/design-system"
      element={(
        <AuthRoute page="admin-design-system" />
      )}
    />
    <Route
      path="/admin"
      element={(
        <AuthRoute page="admin" />
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
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
