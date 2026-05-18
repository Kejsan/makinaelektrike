import type {
  PublicAnnouncementAnalyticsEventType,
  PublicAnnouncementDisplayMode,
} from '../types';

const TRACK_ENDPOINT = '/.netlify/functions/public-announcement-track';

interface AnnouncementTrackPayload {
  announcementId: string;
  eventType: PublicAnnouncementAnalyticsEventType;
  pagePath?: string | null;
  locale?: string | null;
  displayMode?: PublicAnnouncementDisplayMode | null;
}

export const trackPublicAnnouncementEvent = async (payload: AnnouncementTrackPayload) => {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(TRACK_ENDPOINT, blob)) {
        return;
      }
    }

    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
  } catch (error) {
    console.error('Failed to track public announcement event:', error);
  }
};
