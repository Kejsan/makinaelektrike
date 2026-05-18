
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  Send,
  Twitter,
} from 'lucide-react';
import { SITE_LOGO, SITE_LOGO_ALT } from '../constants/media';
import Link from './LocalizedLink';
import { useSiteSettings } from '../hooks/useSiteSettings';

import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToNewsletter } from '../services/newsletter';
import { FunctionJsonResponseError, isFunctionHtmlResponseError } from '../services/serverFunctions';

const isLocalStaticPreview = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname, port } = window.location;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname) && ['4173', '5173'].includes(port);
};

const Footer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { role } = useAuth();
  const { settings } = useSiteSettings();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterCompany, setNewsletterCompany] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  
  const isAdminDashboard = (role === 'admin' || location.pathname.startsWith('/admin')) && location.pathname.startsWith('/admin');

  if (isAdminDashboard) {
    return null;
  }

  const socialLinks = [
    { key: 'facebook', label: 'Facebook', href: settings.socialLinks.facebook, icon: Facebook },
    { key: 'instagram', label: 'Instagram', href: settings.socialLinks.instagram, icon: Instagram },
    { key: 'twitter', label: 'Twitter', href: settings.socialLinks.twitter, icon: Twitter },
    { key: 'linkedin', label: 'LinkedIn', href: settings.socialLinks.linkedin, icon: Linkedin },
  ].filter(item => item.href);

  const handleNewsletterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLocalStaticPreview()) {
      setNewsletterStatus('error');
      setNewsletterMessage(t('footer.newsletterPreviewUnavailable'));
      return;
    }

    setNewsletterStatus('submitting');
    setNewsletterMessage('');

    try {
      await subscribeToNewsletter({
        email: newsletterEmail,
        consent: newsletterConsent,
        locale: i18n.language,
        pagePath: location.pathname,
        company: newsletterCompany,
      });
      setNewsletterStatus('success');
      setNewsletterMessage(t('footer.newsletterSuccess'));
      setNewsletterEmail('');
      setNewsletterConsent(false);
      setNewsletterCompany('');
    } catch (error) {
      const isLocalFunctionPreviewError =
        isFunctionHtmlResponseError(error) ||
        (error instanceof FunctionJsonResponseError && error.status === 404);
      if (!isLocalFunctionPreviewError) {
        console.error('Newsletter subscription failed', error);
      }
      setNewsletterStatus('error');
      setNewsletterMessage(
        isLocalFunctionPreviewError
          ? t('footer.newsletterPreviewUnavailable')
          : error instanceof Error
            ? error.message
            : t('footer.newsletterError'),
      );
    }
  };

  return (
    <footer className="bg-transparent text-white mt-20 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top content */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:gap-16">
          {/* Brand + social */}
          <div className="space-y-6">
            <Link to="/" className="inline-flex items-center text-white" aria-label={t('header.home')}>
              <img src={SITE_LOGO} alt={SITE_LOGO_ALT} className="h-14 w-auto rounded md:h-16" />
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-gray-300">
              {t('footer.description')}
            </p>
            <div className="pt-2">
              {socialLinks.length > 0 && (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    {t('footer.socialTitle')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map(item => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.key}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                        >
                          <span className="sr-only">{item.label}</span>
                          <Icon size={20} />
                        </a>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <form
              onSubmit={handleNewsletterSubmit}
              className="rounded-2xl border border-gray-cyan/25 bg-white/[0.04] p-4 shadow-[0_18px_50px_rgba(0,0,128,0.22)] ring-1 ring-white/5"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-cyan/30 bg-gray-cyan/15 text-gray-cyan">
                  <Mail size={19} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('footer.newsletterTitle')}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-300">{t('footer.newsletterDescription')}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="footer-newsletter-email">
                  {t('footer.newsletterEmailLabel')}
                </label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  value={newsletterEmail}
                  onChange={event => setNewsletterEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t('footer.newsletterPlaceholder')}
                  className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-gray-cyan/70 focus:ring-2 focus:ring-gray-cyan/20"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === 'submitting'}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 text-sm font-bold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {newsletterStatus === 'submitting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {newsletterStatus === 'submitting'
                    ? t('footer.newsletterSubmitting')
                    : t('footer.newsletterSubmit')}
                </button>
              </div>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={newsletterCompany}
                onChange={event => setNewsletterCompany(event.target.value)}
                className="hidden"
                aria-hidden="true"
              />
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-400">
                <input
                  type="checkbox"
                  checked={newsletterConsent}
                  onChange={event => setNewsletterConsent(event.target.checked)}
                  required
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 text-gray-cyan focus:ring-gray-cyan/30"
                />
                <span>{t('footer.newsletterConsent')}</span>
              </label>
              {newsletterMessage && (
                <p
                  className={`mt-3 flex items-start gap-2 text-xs leading-5 ${
                    newsletterStatus === 'success' ? 'text-cyan-100' : 'text-red-100'
                  }`}
                  role={newsletterStatus === 'error' ? 'alert' : 'status'}
                >
                  {newsletterStatus === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-cyan" />}
                  <span>{newsletterMessage}</span>
                </p>
              )}
            </form>
          </div>

          {/* Explore / company / legal – right side */}
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                {t('footer.explore')}
              </h3>
              <ul className="mt-4 space-y-2 text-gray-300">
                <li>
                  <Link to="/listings" className="transition-colors hover:text-white">
                    {t('header.listings')}
                  </Link>
                </li>
                <li>
                  <Link to="/models" className="transition-colors hover:text-white">
                    {t('header.models')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/albania-charging-stations"
                    className="transition-colors hover:text-white"
                  >
                    {t('header.chargingStations')}
                  </Link>
                </li>
                <li>
                  <Link to="/dealers" className="transition-colors hover:text-white">
                    {t('header.dealers')}
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="transition-colors hover:text-white">
                    {t('header.blog')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                {t('footer.aboutUs')}
              </h3>
              <ul className="mt-4 space-y-2 text-gray-300">
                <li>
                  <Link to="/about" className="transition-colors hover:text-white">
                    {t('header.about')}
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="transition-colors hover:text-white">
                    {t('footer.contact')}
                  </Link>
                </li>
                <li>
                  <Link to="/help-center" className="transition-colors hover:text-white">
                    {t('header.helpCenter')}
                  </Link>
                </li>
                <li>
                  <Link to="/sitemap" className="transition-colors hover:text-white">
                    {t('footer.sitemap')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                {t('footer.services')}
              </h3>
              <ul className="mt-4 space-y-2 text-gray-300">
                <li>
                  <Link to="/register" className="transition-colors hover:text-white">
                    {t('footer.userSignup')}
                  </Link>
                </li>
                <li>
                  <Link to="/register-dealer" className="transition-colors hover:text-white">
                    {t('footer.dealerSignup')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                {t('footer.legal')}
              </h3>
              <ul className="mt-4 space-y-2 text-gray-300">
                <li>
                  <Link to="/privacy-policy" className="transition-colors hover:text-white">
                    {t('footer.privacy')}
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="transition-colors hover:text-white">
                    {t('footer.terms')}
                  </Link>
                </li>
                <li>
                  <Link to="/cookie-policy" className="transition-colors hover:text-white">
                    {t('footer.cookies')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <section
          aria-labelledby="footer-important-notice-title"
          className="mt-10 rounded-2xl border border-gray-cyan/25 bg-[linear-gradient(135deg,rgba(84,160,155,0.16),rgba(255,255,255,0.045))] p-5 shadow-[0_20px_70px_rgba(0,0,128,0.28)] ring-1 ring-white/5 md:p-6"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-cyan/30 bg-gray-cyan/15 text-gray-cyan">
                <AlertTriangle size={20} />
              </span>
              <h2 id="footer-important-notice-title" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-cyan/85">
                {t('footer.legalSummary')}
              </h2>
            </div>
            <p className="text-sm leading-7 text-gray-300">
              {t('footer.legalBody')}
            </p>
          </div>
        </section>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-center text-xs text-gray-400 sm:text-sm md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Makina Elektrike. {t('footer.rightsReserved')}</p>
          <p className="text-sm text-gray-400">
            {t('footer.credits')}{' '}
            <a href="https://kejsancoku.com/" target="_blank" rel="noreferrer noopener" className="text-gray-cyan hover:text-white">
              Kejsan Coku
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
