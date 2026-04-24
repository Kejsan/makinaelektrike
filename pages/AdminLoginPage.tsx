import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';

const AdminLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, loading, error, user, role, initializing } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-gray-300">{t('common.loading')}</span>
      </div>
    );
  }

  if (user && role === 'pending') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (user && role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setFormError(t('admin.loginError'));
      return;
    }

    setFormError(null);

    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      // error state handled in context
    }
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('admin.metaTitle'),
    description: t('admin.metaDescription'),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    url: `${BASE_URL}/admin/login`,
  };

  return (
    <div className="py-16">
      <SEO
        title={t('admin.metaTitle')}
        description={t('admin.metaDescription')}
        keywords={t('admin.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/admin/login`}
        robots="noindex, nofollow"
        openGraph={{
          title: t('admin.metaTitle'),
          description: t('admin.metaDescription'),
          url: `${BASE_URL}/admin/login`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('admin.metaTitle'),
          description: t('admin.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden p-8">
          <div className="text-center">
            <Shield className="mx-auto text-gray-cyan h-12 w-12" />
            <h1 className="text-3xl font-extrabold text-white mt-6">{t('admin.loginTitle')}</h1>
            <p className="mt-2 text-gray-300">{t('admin.loginSubtitle')}</p>
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            {t('admin.loginInfo')}
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {(formError || error) && (
              <div className="rounded-md bg-red-500/20 border border-red-500/40 px-4 py-3 text-sm text-red-100">
                {formError || error || t('admin.loginError')}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                {t('admin.loginEmail')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                {t('admin.loginPassword')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center rounded-md border border-transparent bg-gray-cyan/80 px-4 py-2 text-base font-medium text-white hover:bg-gray-cyan transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? '...' : t('admin.loginButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
