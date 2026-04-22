import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { auth, firestore } from '../services/firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { UserPlus } from 'lucide-react';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import LocalizedNavigate from '../components/LocalizedNavigate';
import useLocalizedNavigate from '../hooks/useLocalizedNavigate';

const RegisterUserPage: React.FC = () => {
  const { t } = useTranslation();
  const { registerUser, loading, user, role, initializing } = useAuth();
  const { addToast } = useToast();
  const navigate = useLocalizedNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

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

  if (user) {
    return <LocalizedNavigate to="/favorites" replace />;
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { firstName, lastName, phone, email, password, confirmPassword } = formData;

    if (!firstName || !lastName || !phone || !email || !password) {
      setFormError(t('registerUserPage.validation.required'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('registerUserPage.validation.passwordMismatch'));
      return;
    }

    setFormError(null);

    try {
      await registerUser(email, password, {
        firstName,
        lastName,
        phone,
        displayName: `${firstName} ${lastName}`.trim(),
      });

      const currentUser = auth.currentUser;
      if (currentUser) {
        await setDoc(
          doc(firestore, 'users', currentUser.uid),
          {
            firstName,
            lastName,
            phone,
            displayName: `${firstName} ${lastName}`.trim(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      addToast(t('registerUserPage.success'), 'success');
      navigate('/favorites');
    } catch (error) {
      console.error('Failed to register user', error);
      addToast(
        error instanceof Error ? error.message : t('registerUserPage.error'),
        'error',
      );
    }
  };

  const metaTitle = t('registerUserPage.metaTitle');
  const metaDescription = t('registerUserPage.metaDescription');
  const benefits = t('registerUserPage.benefits', { returnObjects: true }) as string[];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: metaTitle,
    description: metaDescription,
    url: `${BASE_URL}/register/`,
  };

  return (
    <div className="py-16">
      <SEO
        title={metaTitle}
        description={metaDescription}
        keywords={t('registerUserPage.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/register/`}
        robots="noindex, nofollow"
        openGraph={{
          title: metaTitle,
          description: metaDescription,
          url: `${BASE_URL}/register/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: metaTitle,
          description: metaDescription,
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden p-8 text-white">
          <div className="text-center mb-8">
            <UserPlus className="mx-auto text-gray-cyan h-12 w-12" />
            <h1 className="text-3xl font-extrabold mt-6">{t('registerUserPage.title')}</h1>
            <p className="mt-2 text-gray-300">
              {t('registerUserPage.subtitle')}
            </p>
          </div>

          <div className="mb-8 grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6 text-gray-200">
            <p className="font-semibold text-white">{t('registerUserPage.benefitsTitle')}</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
              {benefits.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {formError && (
            <div className="mb-6 rounded-md bg-red-500/20 border border-red-500/40 px-4 py-3 text-sm text-red-100">
              {formError}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-200">
                  {t('registerUserPage.fields.firstName')}
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-200">
                  {t('registerUserPage.fields.lastName')}
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-200">
                {t('registerUserPage.fields.phone')}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                {t('registerUserPage.fields.email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                  {t('registerUserPage.fields.password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200">
                  {t('registerUserPage.fields.confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center rounded-md border border-transparent bg-gray-cyan/80 px-4 py-2 text-base font-medium text-white hover:bg-gray-cyan transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? t('registerUserPage.submitLoading') : t('registerUserPage.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterUserPage;
