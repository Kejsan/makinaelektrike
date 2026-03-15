
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { SITE_LOGO, SITE_LOGO_ALT } from '../constants/media';

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-transparent text-white mt-20 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-8">
            <Link to="/" className="inline-flex items-center text-white" aria-label={t('header.home')}>
              <img src={SITE_LOGO} alt={SITE_LOGO_ALT} className="h-16 w-auto rounded md:h-20" />
            </Link>
            <p className="text-gray-300 text-base leading-relaxed max-w-xl">{t('footer.description')}</p>
            <div>
              <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">{t('footer.socialTitle')}</p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://www.facebook.com/makina-elektrike"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">Facebook</span>
                  <Facebook size={20} />
                </a>
                <a
                  href="https://www.instagram.com/makina-elektrike"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">Instagram</span>
                  <Instagram size={20} />
                </a>
                <a
                  href="https://twitter.com/makina-elektrike"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">Twitter</span>
                  <Twitter size={20} />
                </a>
                <a
                  href="https://www.linkedin.com/company/makina-elektrike"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-glow inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all hover:border-gray-cyan/70 hover:text-gray-cyan"
                >
                  <span className="sr-only">LinkedIn</span>
                  <Linkedin size={20} />
                </a>
              </div>
            </div>
          </div>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">{t('footer.explore')}</h3>
              <ul className="mt-4 space-y-3 text-base text-gray-300">
                <li><Link to="/dealers" className="hover:text-white transition-colors">{t('header.dealers')}</Link></li>
                <li><Link to="/models" className="hover:text-white transition-colors">{t('header.models')}</Link></li>
                <li>
                  <Link to="/albania-charging-stations" className="hover:text-white transition-colors">
                    {t('header.chargingStations')}
                  </Link>
                </li>
                <li><Link to="/blog" className="hover:text-white transition-colors">{t('header.blog')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="space-y-10">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">{t('footer.services')}</h3>
              <ul className="mt-4 space-y-3 text-base text-gray-300">
                <li><Link to="/register" className="hover:text-white transition-colors">{t('footer.userSignup')}</Link></li>
                <li><Link to="/register-dealer" className="hover:text-white transition-colors">{t('footer.dealerSignup')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">{t('footer.aboutUs')}</h3>
              <ul className="mt-4 space-y-3 text-base text-gray-300">
                <li><Link to="/about" className="hover:text-white transition-colors">{t('header.about')}</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">{t('footer.contact')}</Link></li>
                <li><Link to="/sitemap" className="hover:text-white transition-colors">{t('footer.sitemap')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">{t('footer.legal')}</h3>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-base text-gray-300">
                <li><Link to="/privacy-policy" className="hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</Link></li>
                <li><Link to="/cookie-policy" className="hover:text-white transition-colors">{t('footer.cookies')}</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-semibold text-white">{t('footer.moreInfo')}</span>
            <span className="text-xs uppercase tracking-widest text-gray-400">{t('footer.legalSummary')}</span>
          </div>
          <p className="mt-4 leading-relaxed">
            The information on this website is provided on "as is, as available basis" without warranty of any kind. Makina Elektrike is not
            responsible for any omissions, inaccuracies or other errors in the information it publishes. All warranties with respect to this
            information are disclaimed. Reproduction of any part of this website in its entirety or partially or in any form or medium without
            prior written permission is prohibited. The trademarks, marques and logos of the manufacturers of devices and/or dealerships
            described and/or promoted, software, hardware, etc. are the property of their respective owners.
          </p>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Makina Elektrike. {t('footer.rightsReserved')}</p>
          <p className="text-sm text-gray-400">
            {t('footer.credits')}{' '}
            <a href="https://kejsancoku.com/" target="_blank" rel="noreferrer" className="text-gray-cyan hover:text-white">
              Kejsan Coku
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
