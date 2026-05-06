import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Mail, ShieldCheck, Store, UserPlus } from 'lucide-react';
import SEO from '../components/SEO';
import Link from '../components/LocalizedLink';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { acceptAccessInvite, lookupAccessInvite } from '../services/accessInvites';
import type { AccessInvite } from '../types';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import useLocalizedNavigate from '../hooks/useLocalizedNavigate';
import { ADMIN_ROLE_PRESETS } from '../utils/accessControl';

const normalizeEmail = (value: string | null | undefined) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const AcceptInvitePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useLocalizedNavigate();
  const { user, profile, initializing } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [invite, setInvite] = useState<AccessInvite | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const code = searchParams.get('code')?.trim() ?? '';

  useEffect(() => {
    if (!code) {
      setInvite(null);
      setInviteError(
        t('acceptInvitePage.missingCode', {
          defaultValue: 'This invite link is missing its code.',
        }),
      );
      setLoadingInvite(false);
      return;
    }

    let cancelled = false;
    setLoadingInvite(true);
    setInviteError(null);

    void lookupAccessInvite(code)
      .then(loadedInvite => {
        if (!cancelled) {
          setInvite(loadedInvite);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setInvite(null);
          setInviteError(
            error instanceof Error
              ? error.message
              : t('acceptInvitePage.lookupFailed', {
                  defaultValue: 'The invite could not be loaded.',
                }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInvite(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, t]);

  const redirectTarget = useMemo(
    () => (code ? `/accept-invite?code=${encodeURIComponent(code)}` : '/accept-invite'),
    [code],
  );

  const emailMatchesInvite = useMemo(
    () => normalizeEmail(profile?.email) !== '' && normalizeEmail(profile?.email) === normalizeEmail(invite?.email),
    [invite?.email, profile?.email],
  );

  const inviteRoleSummary = useMemo(() => {
    if (!invite) {
      return '';
    }

    if (invite.type === 'platform_admin') {
      const labels = (invite.adminRoleIds ?? []).map(roleId => ADMIN_ROLE_PRESETS[roleId]?.label ?? roleId);
      return labels.length
        ? labels.join(', ')
        : t('acceptInvitePage.platformAdminFallback', { defaultValue: 'Platform admin access' });
    }

    return invite.dealerStaffRole
      ? t('acceptInvitePage.dealerRoleLabel', {
          defaultValue: '{{role}} access',
          role: invite.dealerStaffRole,
        })
      : t('acceptInvitePage.dealerRoleFallback', { defaultValue: 'Dealer staff access' });
  }, [invite, t]);

  const handleAcceptInvite = async () => {
    if (!code) {
      return;
    }

    setAccepting(true);
    try {
      const result = await acceptAccessInvite(code);
      addToast(
        t('acceptInvitePage.accepted', {
          defaultValue: 'Invite accepted successfully.',
        }),
        'success',
      );
      navigate(result.nextPath);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('acceptInvitePage.acceptFailed', {
              defaultValue: 'The invite could not be accepted.',
            });
      setInviteError(message);
      addToast(message, 'error');
    } finally {
      setAccepting(false);
    }
  };

  const metaTitle = t('acceptInvitePage.metaTitle', { defaultValue: 'Accept invite | Makina Elektrike' });
  const metaDescription = t('acceptInvitePage.metaDescription', {
    defaultValue: 'Accept secure dealer staff or platform admin invites on Makina Elektrike.',
  });

  const loginHref = `/login?redirect=${encodeURIComponent(redirectTarget)}${invite?.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`;
  const registerHref = `/register?redirect=${encodeURIComponent(redirectTarget)}${invite?.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`;

  const renderInviteBody = () => {
    if (loadingInvite || initializing) {
      return (
        <div className="flex items-center justify-center gap-3 py-12 text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin text-gray-cyan" />
          <span>{t('common.loading', { defaultValue: 'Loading…' })}</span>
        </div>
      );
    }

    if (!invite) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {inviteError ??
            t('acceptInvitePage.noInvite', {
              defaultValue: 'The invite could not be found.',
            })}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-gray-cyan">
              {invite.type === 'platform_admin' ? <ShieldCheck className="h-5 w-5" /> : <Store className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-cyan">
                {invite.type === 'platform_admin'
                  ? t('acceptInvitePage.platformAdminInvite', { defaultValue: 'Platform admin invite' })
                  : t('acceptInvitePage.dealerStaffInvite', { defaultValue: 'Dealer staff invite' })}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white">
                {invite.type === 'platform_admin'
                  ? t('acceptInvitePage.headingAdmin', { defaultValue: 'Accept admin access' })
                  : t('acceptInvitePage.headingDealer', { defaultValue: 'Join a dealer team' })}
              </h1>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {t('acceptInvitePage.invitedEmail', { defaultValue: 'Invited email' })}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-white">
                <Mail className="h-4 w-4 text-gray-cyan" />
                <span>{invite.email}</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {invite.type === 'platform_admin'
                  ? t('acceptInvitePage.accessLevel', { defaultValue: 'Access level' })
                  : t('acceptInvitePage.dealerWorkspace', { defaultValue: 'Dealer workspace' })}
              </p>
              <p className="mt-2 text-sm text-white">
                {invite.type === 'platform_admin' ? inviteRoleSummary : invite.dealerName ?? inviteRoleSummary}
              </p>
              {invite.type === 'dealer_staff' && inviteRoleSummary ? (
                <p className="mt-1 text-xs text-gray-400">{inviteRoleSummary}</p>
              ) : null}
            </div>
          </div>
        </div>

        {inviteError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {inviteError}
          </div>
        )}

        {invite.status !== 'pending' ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {t('acceptInvitePage.nonPendingStatus', {
              defaultValue: 'This invite is {{status}} and can no longer be accepted.',
              status: invite.status,
            })}
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-gray-300">
              {t('acceptInvitePage.signInPrompt', {
                defaultValue:
                  'Sign in or create a regular user account with the invited email address, then return here to accept the invite.',
              })}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                to={loginHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-semibold text-gray-900 transition hover:opacity-90"
              >
                <ShieldCheck className="h-4 w-4" />
                {t('acceptInvitePage.signIn', { defaultValue: 'Sign in' })}
              </Link>
              <Link
                to={registerHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <UserPlus className="h-4 w-4" />
                {t('acceptInvitePage.createAccount', { defaultValue: 'Create account' })}
              </Link>
            </div>
          </div>
        ) : !emailMatchesInvite ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {t('acceptInvitePage.emailMismatch', {
              defaultValue:
                'You are signed in as a different email address. Switch to the invited account before accepting this invite.',
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-gray-300">
              {invite.type === 'platform_admin'
                ? t('acceptInvitePage.readyAdmin', {
                    defaultValue:
                      'Your signed-in account matches the invite. Accepting will grant the admin presets shown above.',
                  })
                : t('acceptInvitePage.readyDealer', {
                    defaultValue:
                      'Your signed-in account matches the invite. Accepting will attach this account to the dealer workspace.',
                  })}
            </p>
            <button
              type="button"
              onClick={() => void handleAcceptInvite()}
              disabled={accepting}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <span>{t('acceptInvitePage.acceptButton', { defaultValue: 'Accept invite' })}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-16">
      <SEO
        title={metaTitle}
        description={metaDescription}
        canonical={`${BASE_URL}/accept-invite/`}
        robots="noindex, nofollow"
        openGraph={{
          title: metaTitle,
          description: metaDescription,
          url: `${BASE_URL}/accept-invite/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: metaTitle,
          description: metaDescription,
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-gray-950/90 via-slate-900/80 to-black/90 p-8 shadow-2xl">
          {renderInviteBody()}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
