import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PublicAnnouncement } from '../types';
import { resolvePublicAnnouncements } from '../services/publicAnnouncements';
import { trackPublicAnnouncementEvent } from '../services/publicAnnouncementTracking';
import { isFunctionHtmlResponseError } from '../services/serverFunctions';
import { stripLocalePrefix } from '../utils/localizedRouting';

const STORAGE_KEY = 'public-announcements:v1';

interface AnnouncementVisitorState {
  seenCount?: number;
  dismissedAt?: string;
  lastSeenAt?: string;
}

type AnnouncementVisitorStateMap = Record<string, AnnouncementVisitorState>;

interface PublicAnnouncementsContextValue {
  announcements: PublicAnnouncement[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  feedOpen: boolean;
  visibleBanner: PublicAnnouncement | null;
  visibleModal: PublicAnnouncement | null;
  openFeed: () => void;
  closeFeed: () => void;
  dismissAnnouncement: (announcement: PublicAnnouncement) => void;
  markAnnouncementSeen: (announcement: PublicAnnouncement) => void;
  trackAnnouncementClick: (announcement: PublicAnnouncement) => void;
  reloadAnnouncements: () => void;
}

const PublicAnnouncementsContext = createContext<PublicAnnouncementsContextValue>({
  announcements: [],
  loading: false,
  error: null,
  unreadCount: 0,
  feedOpen: false,
  visibleBanner: null,
  visibleModal: null,
  openFeed: () => undefined,
  closeFeed: () => undefined,
  dismissAnnouncement: () => undefined,
  markAnnouncementSeen: () => undefined,
  trackAnnouncementClick: () => undefined,
  reloadAnnouncements: () => undefined,
});

const readStoredState = (): AnnouncementVisitorStateMap => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as AnnouncementVisitorStateMap
      : {};
  } catch {
    return {};
  }
};

const writeStoredState = (state: AnnouncementVisitorStateMap) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local visitor state is a progressive enhancement; ignore storage failures.
  }
};

const canShowSurface = (
  announcement: PublicAnnouncement,
  visitorState: AnnouncementVisitorState | undefined,
  surface: 'banner' | 'modal',
) => {
  if (announcement.displayMode !== surface) {
    return false;
  }
  if (visitorState?.dismissedAt) {
    return false;
  }
  if (surface === 'modal') {
    return (visitorState?.seenCount ?? 0) < announcement.maxViewsPerVisitor;
  }
  return true;
};

export const PublicAnnouncementsProvider: React.FC<{
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ disabled = false, children }) => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { user, role } = useAuth();
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visitorState, setVisitorState] = useState<AnnouncementVisitorStateMap>(() => readStoredState());
  const trackedImpressionsRef = useRef<Set<string>>(new Set());

  const locale = (i18n.resolvedLanguage || i18n.language || 'sq').split('-')[0];
  const pagePath = stripLocalePrefix(location.pathname).pathname || '/';
  const segment = role === 'dealer' ? 'dealer' : user ? 'signed_in' : 'anonymous';

  const updateVisitorState = useCallback((updater: (current: AnnouncementVisitorStateMap) => AnnouncementVisitorStateMap) => {
    setVisitorState(current => {
      const next = updater(current);
      writeStoredState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (disabled) {
      setAnnouncements([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    resolvePublicAnnouncements({
      locale,
      pagePath,
      segment,
      signal: controller.signal,
    })
      .then(response => {
        setAnnouncements(response.announcements);
      })
      .catch(fetchError => {
        if (controller.signal.aborted) {
          return;
        }
        if (isFunctionHtmlResponseError(fetchError)) {
          setAnnouncements([]);
          setError(null);
          return;
        }
        console.error('Failed to resolve public announcements:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load platform updates.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [disabled, locale, pagePath, refreshKey, segment]);

  useEffect(() => {
    announcements.forEach(announcement => {
      if (trackedImpressionsRef.current.has(announcement.id)) {
        return;
      }
      trackedImpressionsRef.current.add(announcement.id);
      void trackPublicAnnouncementEvent({
        announcementId: announcement.id,
        eventType: 'impression',
        pagePath,
        locale,
        displayMode: announcement.displayMode,
      });
    });
  }, [announcements, locale, pagePath]);

  const visibleBanner = useMemo(
    () => announcements.find(announcement => canShowSurface(announcement, visitorState[announcement.id], 'banner')) ?? null,
    [announcements, visitorState],
  );

  const visibleModal = useMemo(
    () => announcements.find(announcement => canShowSurface(announcement, visitorState[announcement.id], 'modal')) ?? null,
    [announcements, visitorState],
  );

  const unreadCount = useMemo(
    () => announcements.filter(announcement => !visitorState[announcement.id]?.lastSeenAt).length,
    [announcements, visitorState],
  );

  const markAnnouncementSeen = useCallback((announcement: PublicAnnouncement) => {
    const now = new Date().toISOString();
    updateVisitorState(current => ({
      ...current,
      [announcement.id]: {
        ...(current[announcement.id] ?? {}),
        lastSeenAt: now,
        seenCount: (current[announcement.id]?.seenCount ?? 0) + 1,
      },
    }));
  }, [updateVisitorState]);

  const dismissAnnouncement = useCallback((announcement: PublicAnnouncement) => {
    const now = new Date().toISOString();
    updateVisitorState(current => ({
      ...current,
      [announcement.id]: {
        ...(current[announcement.id] ?? {}),
        dismissedAt: now,
        lastSeenAt: now,
        seenCount: (current[announcement.id]?.seenCount ?? 0) + 1,
      },
    }));
    void trackPublicAnnouncementEvent({
      announcementId: announcement.id,
      eventType: 'dismiss',
      pagePath,
      locale,
      displayMode: announcement.displayMode,
    });
  }, [locale, pagePath, updateVisitorState]);

  const trackAnnouncementClick = useCallback((announcement: PublicAnnouncement) => {
    markAnnouncementSeen(announcement);
    void trackPublicAnnouncementEvent({
      announcementId: announcement.id,
      eventType: 'click',
      pagePath,
      locale,
      displayMode: announcement.displayMode,
    });
  }, [locale, markAnnouncementSeen, pagePath]);

  const openFeed = useCallback(() => {
    setFeedOpen(true);
    const now = new Date().toISOString();
    updateVisitorState(current => {
      const next = { ...current };
      announcements.forEach(announcement => {
        next[announcement.id] = {
          ...(next[announcement.id] ?? {}),
          lastSeenAt: now,
        };
      });
      return next;
    });
    const firstAnnouncement = announcements[0];
    if (firstAnnouncement) {
      void trackPublicAnnouncementEvent({
        announcementId: firstAnnouncement.id,
        eventType: 'feed_open',
        pagePath,
        locale,
        displayMode: firstAnnouncement.displayMode,
      });
    }
  }, [announcements, locale, pagePath, updateVisitorState]);

  const value = useMemo<PublicAnnouncementsContextValue>(() => ({
    announcements,
    loading,
    error,
    unreadCount,
    feedOpen,
    visibleBanner,
    visibleModal,
    openFeed,
    closeFeed: () => setFeedOpen(false),
    dismissAnnouncement,
    markAnnouncementSeen,
    trackAnnouncementClick,
    reloadAnnouncements: () => setRefreshKey(key => key + 1),
  }), [
    announcements,
    dismissAnnouncement,
    error,
    feedOpen,
    loading,
    markAnnouncementSeen,
    openFeed,
    trackAnnouncementClick,
    unreadCount,
    visibleBanner,
    visibleModal,
  ]);

  return (
    <PublicAnnouncementsContext.Provider value={value}>
      {children}
    </PublicAnnouncementsContext.Provider>
  );
};

export const usePublicAnnouncementsContext = () => useContext(PublicAnnouncementsContext);
