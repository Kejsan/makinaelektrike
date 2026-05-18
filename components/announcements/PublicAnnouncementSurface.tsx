import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ExternalLink, Megaphone, RefreshCcw, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from '../LocalizedLink';
import ModalLayout from '../ModalLayout';
import { usePublicAnnouncementsContext } from '../../contexts/PublicAnnouncementsContext';
import { trackPublicAnnouncementEvent } from '../../services/publicAnnouncementTracking';
import type { PublicAnnouncement } from '../../types';

const isExternalUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

const typeLabel = (type: PublicAnnouncement['type']) => {
  switch (type) {
    case 'feature_release':
      return 'Feature';
    case 'model_batch':
      return 'EV models';
    case 'dealer_added':
      return 'Dealer';
    case 'blog_post':
      return 'Guide';
    case 'charging_update':
      return 'Charging';
    case 'promotion':
      return 'Promotion';
    case 'maintenance':
      return 'Maintenance';
    default:
      return 'Platform';
  }
};

const AnnouncementAction: React.FC<{
  announcement: PublicAnnouncement;
  className?: string;
}> = ({ announcement, className }) => {
  const { trackAnnouncementClick } = usePublicAnnouncementsContext();

  if (!announcement.destinationUrl || !announcement.ctaLabel) {
    return null;
  }

  const classes =
    className ??
    'inline-flex items-center justify-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-white';

  if (isExternalUrl(announcement.destinationUrl)) {
    return (
      <a
        href={announcement.destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackAnnouncementClick(announcement)}
        className={classes}
      >
        <span>{announcement.ctaLabel}</span>
        <ExternalLink className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link
      to={announcement.destinationUrl}
      onClick={() => trackAnnouncementClick(announcement)}
      className={classes}
    >
      <span>{announcement.ctaLabel}</span>
      <ExternalLink className="h-4 w-4" />
    </Link>
  );
};

const AnnouncementCard: React.FC<{ announcement: PublicAnnouncement }> = ({ announcement }) => (
  <article className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
    <div className="flex items-start gap-3">
      {announcement.imageUrl ? (
        <img
          src={announcement.imageUrl}
          alt=""
          className="h-16 w-20 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
          <Sparkles className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
            {typeLabel(announcement.type)}
          </span>
          {announcement.severity === 'critical' && (
            <span className="rounded-full border border-vivid-red/40 bg-vivid-red/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100">
              Important
            </span>
          )}
        </div>
        <h3 className="mt-2 text-sm font-bold text-white">{announcement.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{announcement.summary}</p>
        {announcement.body ? (
          <p className="mt-2 text-xs leading-5 text-slate-400">{announcement.body}</p>
        ) : null}
        <div className="mt-3">
          <AnnouncementAction announcement={announcement} />
        </div>
      </div>
    </div>
  </article>
);

const PublicAnnouncementSurface: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    announcements,
    loading,
    error,
    feedOpen,
    visibleBanner,
    visibleModal,
    closeFeed,
    dismissAnnouncement,
    markAnnouncementSeen,
    reloadAnnouncements,
  } = usePublicAnnouncementsContext();
  const trackedBannerRef = useRef<string | null>(null);
  const trackedModalRef = useRef<string | null>(null);
  const [closedModalIds, setClosedModalIds] = useState<Set<string>>(() => new Set());
  const modalAnnouncement = useMemo(
    () => (visibleModal && !closedModalIds.has(visibleModal.id) ? visibleModal : null),
    [closedModalIds, visibleModal],
  );

  useEffect(() => {
    if (!visibleBanner || trackedBannerRef.current === visibleBanner.id) {
      return;
    }
    trackedBannerRef.current = visibleBanner.id;
    void trackPublicAnnouncementEvent({
      announcementId: visibleBanner.id,
      eventType: 'banner_view',
      pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
      locale: i18n.language,
      displayMode: visibleBanner.displayMode,
    });
  }, [i18n.language, visibleBanner]);

  useEffect(() => {
    if (!modalAnnouncement || trackedModalRef.current === modalAnnouncement.id) {
      return;
    }
    trackedModalRef.current = modalAnnouncement.id;
    void trackPublicAnnouncementEvent({
      announcementId: modalAnnouncement.id,
      eventType: 'modal_view',
      pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
      locale: i18n.language,
      displayMode: modalAnnouncement.displayMode,
    });
  }, [i18n.language, modalAnnouncement]);

  const closeModal = () => {
    if (modalAnnouncement) {
      setClosedModalIds(current => new Set(current).add(modalAnnouncement.id));
      markAnnouncementSeen(modalAnnouncement);
    }
  };

  return (
    <>
      {visibleBanner && (
        <section
          aria-label={t('announcements.bannerLabel', { defaultValue: 'Platform update' })}
          className="border-b border-gray-cyan/20 bg-[#000080] px-4 py-3 text-white"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-cyan text-slate-950">
                <Megaphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">{visibleBanner.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-200">{visibleBanner.summary}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AnnouncementAction
                announcement={visibleBanner}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-cyan/40 bg-gray-cyan/15 px-3 py-2 text-sm font-bold text-white transition hover:bg-gray-cyan/25"
              />
              <button
                type="button"
                onClick={() => dismissAnnouncement(visibleBanner)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label={t('announcements.hideBanner', { defaultValue: 'Hide update' })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {feedOpen && (
        <div className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-sm" role="presentation" onClick={closeFeed}>
          <aside
            className="ml-auto flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#080827] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('announcements.feedTitle', { defaultValue: 'Platform updates' })}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-cyan">
                  {t('announcements.feedEyebrow', { defaultValue: 'Updates' })}
                </p>
                <h2 className="mt-2 text-xl font-black text-white">
                  {t('announcements.feedTitle', { defaultValue: 'Platform updates' })}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {t('announcements.feedDescription', {
                    defaultValue: 'New features, EV model batches, dealers, guides, and charging updates.',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFeed}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                  {t('common.loading')}
                </div>
              ) : error ? (
                <div className="rounded-xl border border-vivid-red/30 bg-vivid-red/10 p-4 text-sm text-red-100">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={reloadAnnouncements}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {t('common.retry', { defaultValue: 'Retry' })}
                  </button>
                </div>
              ) : announcements.length ? (
                <div className="space-y-3">
                  {announcements.map(announcement => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                  <Bell className="mb-3 h-6 w-6 text-gray-cyan" />
                  {t('announcements.emptyFeed', { defaultValue: 'No public platform updates are active right now.' })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {modalAnnouncement && (
        <ModalLayout
          isOpen
          onClose={closeModal}
          maxWidthClass="max-w-2xl"
          headerContent={(
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-cyan text-slate-950">
                <Megaphone className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-cyan">
                  {typeLabel(modalAnnouncement.type)}
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">{modalAnnouncement.title}</h2>
              </div>
            </div>
          )}
        >
          <div className="space-y-5">
            {modalAnnouncement.imageUrl && (
              <img
                src={modalAnnouncement.imageUrl}
                alt=""
                className="aspect-video w-full rounded-xl object-cover"
              />
            )}
            <p className="text-base leading-7 text-slate-200">{modalAnnouncement.summary}</p>
            {modalAnnouncement.body ? (
              <p className="text-sm leading-6 text-slate-300">{modalAnnouncement.body}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <AnnouncementAction announcement={modalAnnouncement} />
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                {t('announcements.notNow', { defaultValue: 'Not now' })}
              </button>
            </div>
          </div>
        </ModalLayout>
      )}
    </>
  );
};

export default PublicAnnouncementSurface;
