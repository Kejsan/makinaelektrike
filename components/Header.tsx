import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Settings, LogOut, Menu, X, UserRound, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SITE_LOGO, SITE_LOGO_ALT } from '../constants/media';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const languages = {
    en: 'English',
    sq: 'Shqip',
    it: 'Italiano',
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white transition-colors hover:text-gray-cyan"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Globe size={20} />
        <span className="hidden md:inline">{t('header.language')}</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-md shadow-lg py-1 z-20">
          {Object.entries(languages).map(([code, name]) => (
            <button
              key={code}
              onClick={() => changeLanguage(code)}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-cyan/20 ${i18n.language === code ? 'text-gray-cyan font-semibold' : 'text-gray-200'
                }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Header: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') {
        return;
      }
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navLinkClasses = (path: string) =>
    `relative px-3 py-2 text-sm font-medium transition-colors ${isActivePath(path)
      ? 'text-gray-cyan'
      : 'text-white hover:text-gray-cyan'
    }`;

  const mobileNavLinkClasses = (path: string) =>
    `block rounded-md px-3 py-2 text-base font-medium transition-colors ${isActivePath(path)
      ? 'text-gray-cyan bg-white/5'
      : 'text-white hover:text-gray-cyan hover:bg-white/5'
    }`;

  const navigationItems = [
    { to: '/', label: t('header.home') },
    { to: '/listings', label: t('header.listings', { defaultValue: 'Cars for Sale' }) },
    { to: '/dealers', label: t('header.dealers') },
    { to: '/models', label: t('header.models') },
    { to: '/albania-charging-stations', label: t('header.chargingStations') },
    { to: '/favorites', label: t('header.favorites') },
    { to: '/blog', label: t('header.blog') },
    { to: '/about', label: t('header.about') },
  ];

  const actionButtonBase = 'h-10 px-4 text-sm font-semibold';

  return (
    <header
      className={`sticky top-0 z-[1200] border-b border-gray-cyan/20 backdrop-blur-lg transition-all duration-300 ${isScrolled ? 'bg-navy-blue/95 shadow-lg shadow-black/20' : 'bg-navy-blue/80'
        }`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="relative flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2 xl:gap-6 min-w-0">
            <Link to="/" className="flex-shrink-0 flex items-center text-white" aria-label={t('header.home')}>
              <img
                src={SITE_LOGO}
                alt={SITE_LOGO_ALT}
                className="h-12 w-auto rounded sm:h-14 lg:h-16"
              />
            </Link>
            <nav className="hidden xl:flex items-center gap-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={navLinkClasses(item.to)}
                  aria-current={isActivePath(item.to) ? 'page' : undefined}
                >
                  {item.label}
                  {isActivePath(item.to) && (
                    <span className="absolute inset-x-2 -bottom-[6px] h-1 rounded-full bg-gradient-to-r from-gray-cyan via-white/70 to-gray-cyan" aria-hidden="true" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 lg:px-3 lg:py-2 shadow-lg shadow-black/10">
              {!user ? (
                <>
                  <Link to="/register" className={`btn btn-outline ${actionButtonBase}`}>
                    {t('header.register')}
                  </Link>
                  <Link to="/register-dealer" className={`btn btn-outline ${actionButtonBase}`}>
                    {t('header.becomeDealer')}
                  </Link>
                  <Link to="/login" className={`btn btn-primary ${actionButtonBase}`}>
                    {t('header.login')}
                  </Link>
                </>
              ) : (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-medium text-white transition hover:border-gray-cyan/70 hover:text-gray-cyan"
                    aria-haspopup="true"
                    aria-expanded={accountMenuOpen}
                  >
                    <UserRound size={18} className="text-gray-cyan" />
                    <span className="max-w-[10rem] truncate text-left">
                      {user.displayName || user.email || t('header.account')}
                    </span>
                  </button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 mt-3 w-56 origin-top-right rounded-xl border border-white/10 bg-navy-blue/95 p-2 shadow-2xl backdrop-blur-xl">
                      <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400">
                        {t('header.accountMenuTitle')}
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        {role === 'admin' && (
                          <Link
                            to="/admin"
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-gray-200 transition hover:bg-white/10"
                          >
                            <span>{t('header.admin')}</span>
                            <Settings size={16} />
                          </Link>
                        )}
                        {role === 'dealer' && (
                          <Link
                            to="/dealer/dashboard"
                            className="rounded-lg px-3 py-2 text-gray-200 transition hover:bg-white/10"
                          >
                            {t('header.dealerDashboard')}
                          </Link>
                        )}
                        {role === 'pending' && (
                          <Link
                            to="/awaiting-approval"
                            className="rounded-lg px-3 py-2 text-gray-200 transition hover:bg-white/10"
                          >
                            {t('header.awaitingApproval')}
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-gray-200 transition hover:bg-white/10 disabled:opacity-60"
                          disabled={loading}
                        >
                          <span>{t('header.logout')}</span>
                          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="hidden h-6 w-px bg-white/15 lg:block" aria-hidden="true" />
              <div className="hidden lg:block">
                <LanguageSwitcher />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex items-center justify-center rounded-md p-2 text-white hover:text-gray-cyan hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gray-cyan xl:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? (t('header.closeMenu') as string) : (t('header.openMenu') as string)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/60 xl:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
              <div className="absolute left-0 top-16 z-50 w-full rounded-b-lg border border-t-0 border-gray-cyan/20 bg-navy-blue/95 backdrop-blur-md shadow-xl xl:hidden">
                <nav className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 pt-4 pb-6 space-y-3">
                  {navigationItems.map((item) => (
                    <Link key={item.to} to={item.to} className={mobileNavLinkClasses(item.to)}>
                      {item.label}
                    </Link>
                  ))}
                  {!user ? (
                    <div className="pt-2 space-y-3">
                      <Link to="/login" className="btn btn-primary w-full justify-center">
                        {t('header.login')}
                      </Link>
                      <Link to="/register" className="btn btn-outline w-full justify-center">
                        {t('header.register')}
                      </Link>
                      <Link to="/register-dealer" className="btn btn-outline w-full justify-center">
                        {t('header.becomeDealer')}
                      </Link>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-3">
                      {role === 'admin' && (
                        <Link to="/admin" className="btn btn-outline w-full justify-center">
                          {t('header.admin')}
                        </Link>
                      )}
                      {role === 'dealer' && (
                        <Link to="/dealer/dashboard" className="btn btn-outline w-full justify-center">
                          {t('header.dealerDashboard')}
                        </Link>
                      )}
                      {role === 'pending' && (
                        <Link to="/awaiting-approval" className="btn btn-outline w-full justify-center">
                          {t('header.awaitingApproval')}
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        type="button"
                        className="btn btn-outline w-full justify-center disabled:opacity-60"
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t('header.logout')}
                      </button>
                    </div>
                  )}
                </nav>
                <div className="border-t border-white/10 px-4 py-3">
                  <LanguageSwitcher />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;