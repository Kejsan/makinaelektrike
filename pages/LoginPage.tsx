import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserRound, Store, ShieldCheck, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import Link from '../components/LocalizedLink';
import LocalizedNavigate from '../components/LocalizedNavigate';
import useLocalizedNavigate from '../hooks/useLocalizedNavigate';

type AccountType = 'user' | 'dealer';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useLocalizedNavigate();
  const { login, loading, error, user, role, initializing } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('user');

  const accountOptions = useMemo(
    () => [
      {
        type: 'user' as AccountType,
        title: t('loginPage.userOption.title'),
        description: t('loginPage.userOption.description'),
        icon: <UserRound className="h-5 w-5 text-gray-cyan" />,
      },
      {
        type: 'dealer' as AccountType,
        title: t('loginPage.dealerOption.title'),
        description: t('loginPage.dealerOption.description'),
        icon: <Store className="h-5 w-5 text-gray-cyan" />,
      },
    ],
    [t]
  );

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-gray-300">{t('common.loading')}</span>
      </div>
    );
  }

  if (user && role === 'pending') {
    return <LocalizedNavigate to="/awaiting-approval" replace />;
  }

  if (user && role === 'dealer') {
    return <LocalizedNavigate to="/dealer/dashboard" replace />;
  }

  if (user) {
    return <LocalizedNavigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      setFormError(t('loginPage.errors.missingFields'));
      return;
    }

    setFormError(null);

    try {
      await login(email, password);
      if (accountType === 'dealer') {
        navigate('/dealer/dashboard');
      } else {
        navigate('/favorites');
      }
    } catch (submitError) {
      console.error('Login failed', submitError);
    }
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('loginPage.metaTitle'),
    description: t('loginPage.metaDescription'),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    url: `${BASE_URL}/login/`,
  };

  return (
    <div className="py-16">
      <SEO
        title={t('loginPage.metaTitle')}
        description={t('loginPage.metaDescription')}
        keywords={t('loginPage.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/login/`}
        robots="noindex, nofollow"
        openGraph={{
          title: t('loginPage.metaTitle'),
          description: t('loginPage.metaDescription'),
          url: `${BASE_URL}/login/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('loginPage.metaTitle'),
          description: t('loginPage.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <div className="text-center lg:text-left">
              <ShieldCheck className="mx-auto h-12 w-12 text-gray-cyan lg:mx-0" />
              <h1 className="mt-6 text-3xl font-extrabold text-white">{t('loginPage.title')}</h1>
              <p className="mt-3 text-base text-gray-300">{t('loginPage.subtitle')}</p>
            </div>

            <div className="mt-8 space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                {t('loginPage.chooseAccount')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {accountOptions.map(option => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setAccountType(option.type)}
                    className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-gray-cyan/60 ${
                      accountType === option.type
                        ? 'border-gray-cyan/60 bg-gray-cyan/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-gray-cyan/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {option.icon}
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide">{option.title}</p>
                        <p className="mt-1 text-xs text-gray-300/90">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form className="mt-10 space-y-6" onSubmit={handleSubmit} noValidate>
              {(formError || error) && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {formError || error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                  {t('loginPage.emailLabel')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900/60 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                  {t('loginPage.passwordLabel')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900/60 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-gray-cyan/80 px-4 py-2 text-base font-medium text-white transition-colors hover:bg-gray-cyan disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? t('loginPage.loading') : t('loginPage.submitLabel')}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="mt-10 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              <p className="font-semibold text-white">{t('loginPage.supportTitle')}</p>
              <p>{t('loginPage.supportDescription')}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link to="/register" className="text-sm font-semibold text-gray-cyan hover:text-white">
                  {t('loginPage.registerUserCta')}
                </Link>
                <Link to="/register-dealer" className="text-sm font-semibold text-gray-cyan hover:text-white">
                  {t('loginPage.registerDealerCta')}
                </Link>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-navy-blue/60 to-black/80 p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white">{t('loginPage.guidance.title')}</h2>
            <p className="mt-3 text-gray-300">{t('loginPage.guidance.description')}</p>

            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-white/10 bg-black/30 p-5">
                <h3 className="text-lg font-semibold text-white">{t('loginPage.guidance.userTitle')}</h3>
                <p className="mt-2 text-sm text-gray-300">{t('loginPage.guidance.userDescription')}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-5">
                <h3 className="text-lg font-semibold text-white">{t('loginPage.guidance.dealerTitle')}</h3>
                <p className="mt-2 text-sm text-gray-300">{t('loginPage.guidance.dealerDescription')}</p>
              </div>
              <div className="rounded-xl border border-gray-700/70 bg-black/40 p-5 text-sm text-gray-300">
                <p>{t('loginPage.guidance.security')}</p>
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-6 text-sm text-gray-400">
              <span>{t('loginPage.adminPrompt')}</span>{' '}
              <Link
                to="/admin/login"
                className="font-semibold text-gray-cyan hover:text-white"
              >
                {t('loginPage.adminLinkLabel')}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
