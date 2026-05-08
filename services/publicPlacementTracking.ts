import type { PlacementAnalyticsEventType } from '../types';

interface PlacementTrackPayload {
  campaignId: string;
  zoneKey: string;
  eventType: PlacementAnalyticsEventType;
  pagePath: string;
  locale?: string;
}

const TRACK_ENDPOINT = '/.netlify/functions/public-placement-track';

const sendWithBeacon = (payload: PlacementTrackPayload) => {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json',
    });
    return navigator.sendBeacon(TRACK_ENDPOINT, blob);
  } catch {
    return false;
  }
};

const sendWithFetch = async (payload: PlacementTrackPayload) => {
  try {
    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    console.error('Failed to track public placement event:', error);
  }
};

export const buildPlacementImpressionSessionKey = (
  campaignId: string,
  zoneKey: string,
  pagePath: string,
) => `placement-impression:${pagePath}:${zoneKey}:${campaignId}`;

export const trackPublicPlacementEvent = async (payload: PlacementTrackPayload) => {
  const sent = sendWithBeacon(payload);
  if (!sent) {
    await sendWithFetch(payload);
  }
};
