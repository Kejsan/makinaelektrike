
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { SITE_LOGO, SITE_LOGO_ALT } from '../constants/media';

import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { role } = useAuth();
  
  const isAdminDashboard = (role === 'admin' || location.pathname.startsWith('/admin')) && location.pathname.startsWith('/admin');

  if (isAdminDashboard) {
    return null;
  }

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
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                {t('footer.socialTitle')}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://www.facebook.com/makina-elektrike"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">Facebook</span>
                  <Facebook size={20} />
                </a>
                <a
                  href="https://www.instagram.com/makina-elektrike"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">Instagram</span>
                  <Instagram size={20} />
                </a>
                <a
                  href="https://twitter.com/makina-elektrike"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">Twitter</span>
                  <Twitter size={20} />
                </a>
                <a
                  href="https://www.linkedin.com/company/makina-elektrike"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">LinkedIn</span>
                  <Linkedin size={20} />
                </a>
              </div>
            </div>
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
                    {t('header.listings', { defaultValue: 'Cars for Sale' })}
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

        {/* Legal summary card */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-relaxed text-gray-300 sm:text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-semibold text-white">{t('footer.moreInfo')}</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-gray-400 sm:text-xs">
              {t('footer.legalSummary')}
            </span>
          </div>
          <p className="mt-3">
            The information on this website is provided on an "as is, as available" basis without warranty of any kind. Makina
            Elektrike is not responsible for any omissions, inaccuracies, or other errors in the information it publishes. All
            warranties with respect to this information are disclaimed. Reproduction of any part of this website in whole or in
            part, in any form or medium, without prior written permission is prohibited. The trademarks and logos of the
            manufacturers, dealerships, software, and hardware described or promoted are the property of their respective owners.
          </p>
        </div>

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
