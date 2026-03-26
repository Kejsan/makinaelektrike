import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Settings, LogOut, Menu, X, UserRound, Loader2, ChevronDown, Heart } from 'lucide-react';
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const discoverDropdownRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleDiscoverOutsideClick = (event: MouseEvent) => {
      if (!discoverDropdownRef.current) return;
      if (!discoverDropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleDiscoverOutsideClick);
    return () => document.removeEventListener('mousedown', handleDiscoverOutsideClick);
  }, []);

  const isDashboardRoute = location.pathname.startsWith('/admin') || 
                           location.pathname.startsWith('/dealer/dashboard') || 
                           location.pathname.startsWith('/dealer/listings');
                           
  // Hide header for master admins on dashboard routes to prevent layout overlaps
  const isAdminDashboard = role === 'admin' && location.pathname.startsWith('/admin');

  if (isAdminDashboard) {
    return null;
  }

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navLinkClasses = (path: string) =>
    `relative px-3 py-2 text-sm font-medium transition-colors ${isActivePath(path)
      ? 'text-blue-400'
      : 'text-slate-100 hover:text-blue-400'
    }`;

  const mobileNavLinkClasses = (path: string) =>
    `block rounded-md px-3 py-2 text-base font-medium transition-colors ${isActivePath(path)
      ? 'text-gray-cyan bg-white/5'
      : 'text-white hover:text-gray-cyan hover:bg-white/5'
    }`;

  const primaryNav = [
    { to: '/listings', label: t('header.listings', { defaultValue: 'Cars for Sale' }) },
    { to: '/models', label: t('header.models') },
    { to: '/albania-charging-stations', label: t('header.chargingStations') },
  ];

  const discoverNav = [
    { to: '/about', label: t('header.about') },
    { to: '/blog', label: t('header.blog') },
    { to: '/dealers', label: t('header.dealers') },
  ];

  const actionButtonBase = 'h-10 px-4 text-sm font-semibold';

  return (
    <header
      className={`sticky top-0 z-[1200] border-b border-slate-800 transition-all duration-300 ${isScrolled ? 'bg-[#0b132b]/95 shadow-lg shadow-black/40' : 'bg-[#0b132b]'
        }`}
    >
      {/* Top utility bar – secondary actions */}
      <div className="hidden md:flex justify-end gap-6 bg-slate-950 px-4 py-2 text-xs text-slate-300">
        <button
          type="button"
          onClick={() => navigate('/register-dealer')}
          className="hover:text-white transition-colors"
        >
          {t('header.becomeDealer')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/help-center')}
          className="hover:text-white transition-colors"
        >
          {t('header.helpCenter', { defaultValue: 'Help Center' })}
        </button>
      </div>

      {/* Main navigation */}
      <nav className="px-3 sm:px-4 lg:px-6 py-3 shadow-lg relative z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Logo / brand */}
          <Link to="/" className="flex-shrink-0 flex items-center text-white" aria-label={t('header.home')}>
            <img
              src={SITE_LOGO}
              alt={SITE_LOGO_ALT}
              className="h-12 w-auto rounded sm:h-14 lg:h-16"
            />
          </Link>

          {/* Desktop navigation */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <nav className="flex items-center gap-6 text-sm font-medium text-slate-100">
              {primaryNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={navLinkClasses(item.to)}
                  aria-current={isActivePath(item.to) ? 'page' : undefined}
                >
                  {item.label}
                  {isActivePath(item.to) && (
                    <span className="absolute inset-x-1 -bottom-1 h-0.5 rounded-full bg-blue-400" aria-hidden="true" />
                  )}
                </Link>
              ))}

              {/* Discover dropdown (secondary pages) */}
              <div className="relative" ref={discoverDropdownRef}>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:text-blue-400"
                  onClick={() =>
                    setActiveDropdown((current) => (current === 'discover' ? null : 'discover'))
                  }
                >
                  {t('header.discover', { defaultValue: 'Discover' })}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'discover' ? 'rotate-180' : ''
                      }`}
                  />
                </button>
                {activeDropdown === 'discover' && (
                  <div className="absolute left-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-100 shadow-xl">
                    {discoverNav.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="block px-4 py-2 hover:bg-slate-800 hover:text-blue-400"
                        onClick={() => setActiveDropdown(null)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Desktop utilities & auth */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Utility icons */}
            <div className="flex items-center gap-4 border-r border-slate-700 pr-5">
              <Link
                to="/favorites"
                className="relative text-slate-300 transition-colors hover:text-red-400"
                aria-label={t('header.favorites')}
              >
                <Heart className="h-5 w-5" />
              </Link>
              <div className="flex items-center text-slate-300 hover:text-white transition-colors">
                <LanguageSwitcher />
              </div>
            </div>

            {/* Auth area */}
            {!user ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
                >
                  {t('header.login')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500"
                >
                  {t('header.register')}
                </button>
              </div>
            ) : (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-medium text-white transition hover:border-gray-cyan/70 hover:text-gray-cyan"
                  aria-haspopup="true"
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
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-200 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
            aria-label={mobileMenuOpen ? (t('header.closeMenu') as string) : (t('header.openMenu') as string)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute left-0 top-full w-full border-t border-slate-800 bg-[#0b132b] px-4 pb-6 pt-4 shadow-2xl">
            <div className="flex flex-col gap-3 text-sm font-medium text-white">
              <Link to="/listings" className={mobileNavLinkClasses('/listings')}>
                {t('header.listings', { defaultValue: 'Cars for Sale' })}
              </Link>
              <Link to="/models" className={mobileNavLinkClasses('/models')}>
                {t('header.models')}
              </Link>
              <Link
                to="/albania-charging-stations"
                className={mobileNavLinkClasses('/albania-charging-stations')}
              >
                {t('header.chargingStations')}
              </Link>
              <Link to="/about" className={mobileNavLinkClasses('/about')}>
                {t('header.about')}
              </Link>
              <Link to="/blog" className={mobileNavLinkClasses('/blog')}>
                {t('header.blog')}
              </Link>
              <Link to="/dealers" className={mobileNavLinkClasses('/dealers')}>
                {t('header.dealers')}
              </Link>

              <div className="my-2 h-px bg-slate-800" />

              <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2">
                <span className="text-sm text-slate-100">{t('header.language')}</span>
                <LanguageSwitcher />
              </div>

              <Link
                to="/favorites"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900"
              >
                <Heart className="h-5 w-5" />
                <span>{t('header.favorites')}</span>
              </Link>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {!user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="rounded-lg bg-slate-800 py-3 text-sm font-medium text-white"
                    >
                      {t('header.login')}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/register')}
                      className="rounded-lg bg-blue-600 py-3 text-sm font-medium text-white"
                    >
                      {t('header.register')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loading}
                    className="col-span-2 rounded-lg bg-slate-800 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    ) : null}
                    {t('header.logout')}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/register-dealer')}
                className="mt-4 text-center text-xs font-medium text-slate-400 underline"
              >
                {t('header.becomeDealer')}
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;