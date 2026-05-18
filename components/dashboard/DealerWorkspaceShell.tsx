import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  BookOpen,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import Link from '../LocalizedLink';
import { useAuth } from '../../contexts/AuthContextCore';
import DashboardInfoTooltip from '../DashboardInfoTooltip';

interface DealerWorkspaceShellProps {
  children: React.ReactNode;
}

const DealerWorkspaceShell: React.FC<DealerWorkspaceShellProps> = ({ children }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      to: '/dealer/dashboard',
      label: t('dealerWorkspace.dashboard'),
      icon: <LayoutDashboard className="h-4 w-4" />,
      description: t('dealerWorkspace.dashboardHelp', {
        defaultValue: 'Main dealer workspace for profile, models, images, enquiries, promotions, and team access.',
      }),
    },
    {
      to: '/dealer/listings',
      label: t('dealerWorkspace.listings'),
      icon: <ListChecks className="h-4 w-4" />,
      description: t('dealerWorkspace.listingsHelp', {
        defaultValue: 'Inventory manager for creating, editing, filtering, hiding, and monitoring vehicle listings.',
      }),
    },
    {
      to: '/dealer/guide',
      label: t('dealerWorkspace.guide', { defaultValue: 'How-to guide' }),
      icon: <BookOpen className="h-4 w-4" />,
      description: t('dealerWorkspace.guideHelp', {
        defaultValue: 'Private dealer manual explaining dashboard workflows, listing rules, promotions, and admin review.',
      }),
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gray-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-cyan">
                <ShieldCheck className="h-4 w-4" />
                <span>{t('dealerWorkspace.label')}</span>
              </div>
              <p className="mt-1 truncate text-xs text-gray-400">
                {user?.email || t('dealerWorkspace.accountFallback')}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2">
                <Link
                  to="/dealer/listings?new=1"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-cyan-300"
                >
                  <FilePlus2 className="h-4 w-4" />
                  {t('dealerWorkspace.newListing')}
                </Link>
                <DashboardInfoTooltip
                  label={t('dealerWorkspace.newListingHelp', {
                    defaultValue: 'Start a new vehicle listing. New listings are saved for admin review before public visibility.',
                  })}
                  side="left"
                />
              </div>
              <div className="inline-flex items-center gap-2">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('dealerWorkspace.viewSite')}
                </Link>
                <DashboardInfoTooltip
                  label={t('dealerWorkspace.viewSiteHelp', {
                    defaultValue: 'Open the public website to verify how dealer and listing changes appear to visitors.',
                  })}
                  side="left"
                />
              </div>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                >
                  <LogOut className="h-4 w-4" />
                  {t('dealerWorkspace.logout')}
                </button>
                <DashboardInfoTooltip
                  label={t('dealerWorkspace.logoutHelp', {
                    defaultValue: 'End this dealer dashboard session and return to login.',
                  })}
                  side="left"
                />
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t('dealerWorkspace.navigation')}>
            {navItems.map(item => {
              const isActive =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <span key={item.to} className="inline-flex flex-none items-center gap-2">
                  <Link
                    to={item.to}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-white text-gray-950'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                  <DashboardInfoTooltip label={item.description} />
                </span>
              );
            })}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
};

export default DealerWorkspaceShell;
