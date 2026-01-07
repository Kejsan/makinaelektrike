import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth, mapErrorToMessage } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { auth, firestore } from '../services/firebase';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';

const RegisterDealerPage: React.FC = () => {
  const { registerDealer, loading, user, role, initializing } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    city: '',
    website: '',
    email: '',
    password: '',
    confirmPassword: '',
    notes: '',
  });

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-gray-300">Loading...</span>
      </div>
    );
  }

  if (user && role === 'pending') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (user && role !== 'pending') {
    return <Navigate to="/" replace />;
  }

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const {
      companyName,
      contactName,
      phone,
      city,
      website,
      email,
      password,
      confirmPassword,
      notes,
    } = formData;

    if (!companyName || !contactName || !phone || !city || !email || !password) {
      setFormError('Please complete all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormError(null);

    try {
      await registerDealer(email, password, {
        companyName,
        contactName,
        phone,
        city,
        website,
        notes,
      });

      addToast(
        'Registration received! Our team will review your dealership information shortly.',
        'success'
      );
      navigate('/awaiting-approval');
    } catch (error: any) {
      console.error('Failed to register dealer', error);
      const errorMsg = mapErrorToMessage(error);
      setFormError(errorMsg);
      addToast(errorMsg, 'error');
    }
  };

  const metaTitle = 'Regjistro dilerin | Makina Elektrike';
  const metaDescription = 'Apliko për t’u listuar si dealer i autorizuar i makinave elektrike në Shqipëri.';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: metaTitle,
    description: metaDescription,
    url: `${BASE_URL}/register-dealer/`,
  };

  return (
    <div className="py-16">
      <SEO
        title={metaTitle}
        description={metaDescription}
        keywords={['regjistrim dealer', 'makina elektrike', 'listo dilerin', 'Makina Elektrike']}
        canonical={`${BASE_URL}/register-dealer/`}
        openGraph={{
          title: metaTitle,
          description: metaDescription,
          url: `${BASE_URL}/register-dealer/`,
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden p-8 text-white">
          <div className="text-center mb-8">
            <Building2 className="mx-auto text-gray-cyan h-12 w-12" />
            <h1 className="text-3xl font-extrabold mt-6">Dealer Registration</h1>
            <p className="mt-2 text-gray-300">
              Submit your details to join Makina Elektrike as a trusted electric vehicle dealer.
            </p>
          </div>

          <div className="mb-8 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-6 text-gray-200">
            <p className="font-semibold text-white">Benefits of joining Makina Elektrike:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
              <li>Reach EV buyers across Albania with localized, SEO-friendly listings.</li>
              <li>Publish detailed model information and update inventory in real time.</li>
              <li>Access marketing support, analytics and lead notifications from our team.</li>
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
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-200">
                  Company Name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-200">
                  Primary Contact
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  type="text"
                  value={formData.contactName}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-200">
                  Contact Number
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
                <label htmlFor="city" className="block text-sm font-medium text-gray-200">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-200">
                  Website
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  placeholder="https://"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                  Business Email
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
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-200">
                About Your Dealership
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-white focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                rows={4}
                placeholder="Tell us about your inventory, specialties, and experience."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                  Password
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
                  Confirm Password
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
              {loading ? 'Submitting application...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterDealerPage;
