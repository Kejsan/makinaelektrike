import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin } from 'lucide-react';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { useToast } from '../contexts/ToastContext';
import { submitContactMessage } from '../services/contact';

const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const supportHighlights = t('contactPage.highlights', { returnObjects: true }) as Array<{ title: string; description: string }>;
  const faqItems = t('contactPage.faqItems', { returnObjects: true }) as Array<{ question: string; answer: string }>;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    company: '',
  });

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await submitContactMessage({
        ...formData,
        locale: document.documentElement.lang || undefined,
        pagePath: window.location.pathname,
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        message: '',
        company: '',
      });
      addToast(t('contactPage.form.success'), 'success');
    } catch (error) {
      console.error('Failed to submit contact form', error);
      addToast(
        error instanceof Error ? error.message : t('contactPage.form.error'),
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: t('contactPage.metaTitle'),
      description: t('contactPage.metaDescription'),
      url: `${BASE_URL}/contact/`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Makina Elektrike',
      url: BASE_URL,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'info@makinaelektrike.al',
        areaServed: 'AL',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <div className="py-16">
      <SEO
        title={t('contactPage.metaTitle')}
        description={t('contactPage.metaDescription')}
        keywords={t('contactPage.metaKeywords', { returnObjects: true }) as string[]}
        canonical={`${BASE_URL}/contact/`}
        openGraph={{
          title: t('contactPage.metaTitle'),
          description: t('contactPage.metaDescription'),
          url: `${BASE_URL}/contact/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: t('contactPage.metaTitle'),
          description: t('contactPage.metaDescription'),
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl">
            {t('contactPage.title')}
          </h1>
          <p className="mt-4 text-xl text-gray-400">
            {t('contactPage.p1')}
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {supportHighlights.map(highlight => (
            <div key={highlight.title} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <h3 className="text-xl font-semibold text-white">{highlight.title}</h3>
              <p className="mt-3 text-gray-300 leading-relaxed">{highlight.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 bg-gradient-to-r from-gray-cyan/20 to-vivid-red/20 border border-white/10 rounded-xl p-8 text-center space-y-4 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white">{t('contactPage.ctaTitle')}</h2>
            <p className="mt-3 text-gray-300 text-lg max-w-2xl mx-auto">{t('contactPage.ctaDescription')}</p>
            <div className="pt-6">
              <button
                onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex justify-center rounded-md border border-transparent bg-vivid-red px-8 py-3 text-base font-medium text-white shadow-sm transition-all hover:bg-opacity-90 hover:shadow-lg hover:shadow-vivid-red/50 focus:outline-none focus:ring-2 focus:ring-vivid-red focus:ring-offset-2"
              >
                {t('contactPage.ctaButton')}
              </button>
            </div>
          </div>
        </div>

        <div id="contact-form" className="mt-12 bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{t('contactPage.email')}</h2>
                <p className="mt-2 text-gray-300">{t('contactPage.p1')}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-gray-cyan text-white">
                    <Mail size={24} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-medium text-white">{t('contactPage.email')}</h3>
                    <p className="mt-1 text-gray-300">
                      <a href="mailto:info@makinaelektrike.al" className="hover:underline">
                        info@makinaelektrike.al
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-gray-cyan text-white">
                    <MapPin size={24} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-medium text-white">{t('contactPage.address')}</h3>
                    <p className="mt-1 text-gray-300">{t('contactPage.addressDetails')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">{t('contactPage.form.title')}</h2>
              <p className="mt-2 text-gray-300">{t('contactPage.form.subtitle')}</p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="company">{t('contactPage.form.honeypot')}</label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    value={formData.company}
                    onChange={handleChange}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="name" className="sr-only">
                    {t('common.name')}
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    autoComplete="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-600 bg-white/10 px-4 py-3 text-white placeholder-gray-400 shadow-sm focus:border-gray-cyan focus:ring-gray-cyan"
                    placeholder={t('contactPage.form.namePlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="sr-only">
                    {t('common.email')}
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-600 bg-white/10 px-4 py-3 text-white placeholder-gray-400 shadow-sm focus:border-gray-cyan focus:ring-gray-cyan"
                    placeholder={t('contactPage.form.emailPlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="sr-only">
                    {t('common.phone')}
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-600 bg-white/10 px-4 py-3 text-white placeholder-gray-400 shadow-sm focus:border-gray-cyan focus:ring-gray-cyan"
                    placeholder={t('contactPage.form.phonePlaceholder')}
                  />
                </div>
                <div>
                  <label htmlFor="message" className="sr-only">
                    {t('common.message')}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    required
                    value={formData.message}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-600 bg-white/10 px-4 py-3 text-white placeholder-gray-400 shadow-sm focus:border-gray-cyan focus:ring-gray-cyan"
                    placeholder={t('contactPage.form.messagePlaceholder')}
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex justify-center rounded-md border border-transparent bg-vivid-red px-6 py-3 text-base font-medium text-white shadow-sm transition-all hover:bg-opacity-90 hover:shadow-lg hover:shadow-vivid-red/50 focus:outline-none focus:ring-2 focus:ring-vivid-red focus:ring-offset-2"
                  >
                    {isSubmitting ? t('contactPage.form.submitLoading') : t('contactPage.form.submit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <section className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center">{t('contactPage.faqTitle')}</h2>
          <p className="mt-3 text-gray-300 text-center">{t('contactPage.faqSubtitle')}</p>
          <div className="mt-8 space-y-6">
            {faqItems.map(faq => (
              <div key={faq.question} className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 text-gray-300 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactPage;
