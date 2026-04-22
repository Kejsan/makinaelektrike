import React, { Suspense, lazy, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTopButton from './components/ScrollToTopButton';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataContext, DataProvider } from './contexts/DataContext';
import { ToastProvider, ToastContainer } from './contexts/ToastContext';
import ScrollRestoration from './components/ScrollRestoration';

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
const AwaitingApprovalPage = lazy(() => import('./pages/AwaitingApprovalPage'));
const DealerDashboardPage = lazy(() => import('./pages/DealerDashboardPage'));
const DealerListingsPage = lazy(() => import('./pages/DealerListingsPage'));
const ListingsPage = lazy(() => import('./pages/ListingsPage'));
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SitemapPage = lazy(() => import('./pages/SitemapPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const CookiesPolicyPage = lazy(() => import('./pages/CookiesPolicyPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));

const LoadingScreen = () => (
  <div className="flex items-center justify-center py-24">
    <span className="text-gray-300">Loading...</span>
  </div>
);

const RouteContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
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
  const { dealers, loading: dataLoading } = useContext(DataContext);

  const dealerRecord = useMemo(() => {
    if (!user) {
      return null;
    }
    return dealers.find(dealer => dealer.id === user.uid || dealer.ownerUid === user.uid) ?? null;
  }, [dealers, user]);

  if (initializing || authLoading || dataLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
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

const App: React.FC = () => {

  return (
    <BrowserRouter>
      <ScrollRestoration />
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-grow">
                <Routes>
                  <Route path="/" element={<RouteContent><HomePage /></RouteContent>} />
                  <Route path="/dealers" element={<RouteContent><DealersListPage /></RouteContent>} />
                  <Route path="/dealers/:id" element={<RouteContent><DealerDetailPage /></RouteContent>} />
                  <Route path="/albania-charging-stations" element={<RouteContent><ChargingStationsAlbaniaPage /></RouteContent>} />
                  <Route path="/models" element={<RouteContent><ModelsListPage /></RouteContent>} />
                  <Route path="/models/:id" element={<RouteContent><ModelDetailPage /></RouteContent>} />
                  <Route path="/listings" element={<RouteContent><ListingsPage /></RouteContent>} />
                  <Route path="/listings/:id" element={<RouteContent><ListingDetailPage /></RouteContent>} />
                  <Route path="/blog" element={<RouteContent><BlogPage /></RouteContent>} />
                  <Route path="/blog/:slug" element={<RouteContent><BlogPostPage /></RouteContent>} />
                  <Route path="/about" element={<RouteContent><AboutPage /></RouteContent>} />
                  <Route path="/help-center" element={<RouteContent><HelpCenterPage /></RouteContent>} />
                  <Route path="/contact" element={<RouteContent><ContactPage /></RouteContent>} />
                  <Route path="/favorites" element={<RouteContent><FavoritesPage /></RouteContent>} />
                  <Route path="/register" element={<RouteContent><RegisterUserPage /></RouteContent>} />
                  <Route path="/register-dealer" element={<RouteContent><RegisterDealerPage /></RouteContent>} />
                  <Route path="/login" element={<RouteContent><LoginPage /></RouteContent>} />
                  <Route path="/sitemap" element={<RouteContent><SitemapPage /></RouteContent>} />
                  <Route path="/privacy-policy" element={<RouteContent><PrivacyPolicyPage /></RouteContent>} />
                  <Route path="/terms" element={<RouteContent><TermsOfServicePage /></RouteContent>} />
                  <Route path="/cookie-policy" element={<RouteContent><CookiesPolicyPage /></RouteContent>} />
                  <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
                  <Route path="/cookies" element={<Navigate to="/cookie-policy" replace />} />
                  <Route path="/admin/login" element={<RouteContent><AdminLoginPage /></RouteContent>} />
                  <Route path="/awaiting-approval" element={<RouteContent><AwaitingApprovalPage /></RouteContent>} />
                  <Route
                    path="/dealer/listings"
                    element={
                      <RouteContent>
                        <DealerRoute>
                          <DealerListingsPage />
                        </DealerRoute>
                      </RouteContent>
                    }
                  />
                  <Route
                    path="/dealer/dashboard"
                    element={(
                      <RouteContent>
                        <DealerRoute>
                          <DealerDashboardPage />
                        </DealerRoute>
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
              </main>
              <Footer />
              <ScrollToTopButton />
              <ToastContainer />
            </div>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
