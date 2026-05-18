import type { DocumentData } from 'firebase-admin/firestore';
import type {
  PlacementEntityType,
  PublicAnnouncement,
  PublicAnnouncementAnalyticsEventType,
  PublicAnnouncementAnalyticsSummary,
  PublicAnnouncementDisplayMode,
  PublicAnnouncementFormValues,
  PublicAnnouncementSegment,
  PublicAnnouncementSeverity,
  PublicAnnouncementSourceType,
  PublicAnnouncementStatus,
  PublicAnnouncementType,
} from '../../../types';
import { parseStringList, serializeTimestamp } from './placements';

export const PUBLIC_ANNOUNCEMENT_TYPES: readonly PublicAnnouncementType[] = [
  'feature_release',
  'model_batch',
  'dealer_added',
  'blog_post',
  'charging_update',
  'platform_notice',
  'promotion',
  'maintenance',
];

export const PUBLIC_ANNOUNCEMENT_SEVERITIES: readonly PublicAnnouncementSeverity[] = [
  'info',
  'highlight',
  'critical',
];

export const PUBLIC_ANNOUNCEMENT_STATUSES: readonly PublicAnnouncementStatus[] = [
  'draft',
  'scheduled',
  'active',
  'paused',
  'archived',
];

export const PUBLIC_ANNOUNCEMENT_DISPLAY_MODES: readonly PublicAnnouncementDisplayMode[] = [
  'feed_only',
  'banner',
  'modal',
];

export const PUBLIC_ANNOUNCEMENT_SEGMENTS: readonly PublicAnnouncementSegment[] = [
  'all',
  'anonymous',
  'signed_in',
  'dealer',
];

export const PUBLIC_ANNOUNCEMENT_EVENT_TYPES: readonly PublicAnnouncementAnalyticsEventType[] = [
  'impression',
  'click',
  'dismiss',
  'feed_open',
  'modal_view',
  'banner_view',
];

const SOURCE_ENTITY_TYPES: ReadonlyArray<PlacementEntityType | 'feature' | 'system'> = [
  'dealer',
  'listing',
  'model',
  'charging_station',
  'blog_post',
  'service',
  'custom',
  'feature',
  'system',
];

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const cleanRequiredText = (value: unknown, field: string, maxLength: number) => {
  const text = cleanText(value, maxLength);
  if (!text) {
    throw new Error(`${field} is required.`);
  }
  return text;
};

const cleanOptionalText = (value: unknown, maxLength: number) => {
  const text = cleanText(value, maxLength);
  return text || null;
};

const parseDateValue = (value: unknown) => {
  const text = cleanText(value, 64);
  if (!text) {
    return null;
  }

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    throw new Error('Announcement dates must be valid.');
  }

  return new Date(timestamp).toISOString();
};

const normalizePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') {
    return '*';
  }
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  const [pathOnly] = withoutOrigin.split(/[?#]/);
  const withSlash = pathOnly?.startsWith('/') ? pathOnly : `/${pathOnly ?? ''}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
};

export const parseAnnouncementType = (value: unknown): PublicAnnouncementType =>
  (PUBLIC_ANNOUNCEMENT_TYPES as readonly string[]).includes(String(value))
    ? (value as PublicAnnouncementType)
    : 'platform_notice';

export const parseAnnouncementSeverity = (value: unknown): PublicAnnouncementSeverity =>
  (PUBLIC_ANNOUNCEMENT_SEVERITIES as readonly string[]).includes(String(value))
    ? (value as PublicAnnouncementSeverity)
    : 'info';

export const parseAnnouncementStatus = (value: unknown): PublicAnnouncementStatus =>
  (PUBLIC_ANNOUNCEMENT_STATUSES as readonly string[]).includes(String(value))
    ? (value as PublicAnnouncementStatus)
    : 'draft';

export const parseAnnouncementDisplayMode = (value: unknown): PublicAnnouncementDisplayMode =>
  (PUBLIC_ANNOUNCEMENT_DISPLAY_MODES as readonly string[]).includes(String(value))
    ? (value as PublicAnnouncementDisplayMode)
    : 'feed_only';

export const parseAnnouncementSegments = (value: unknown): PublicAnnouncementSegment[] => {
  const segments = parseStringList(value, 32).filter((entry): entry is PublicAnnouncementSegment =>
    (PUBLIC_ANNOUNCEMENT_SEGMENTS as readonly string[]).includes(entry),
  );

  return segments.length ? segments : ['all'];
};

const parseSourceEntityType = (value: unknown) => {
  const text = cleanText(value, 64);
  return (SOURCE_ENTITY_TYPES as readonly string[]).includes(text)
    ? (text as PlacementEntityType | 'feature' | 'system')
    : null;
};

export const serializePublicAnnouncement = (id: string, data: DocumentData): PublicAnnouncement => ({
  id,
  type: parseAnnouncementType(data.type),
  severity: parseAnnouncementSeverity(data.severity),
  status: parseAnnouncementStatus(data.status),
  displayMode: parseAnnouncementDisplayMode(data.displayMode),
  title: typeof data.title === 'string' ? data.title : '',
  summary: typeof data.summary === 'string' ? data.summary : '',
  body: typeof data.body === 'string' ? data.body : null,
  ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : null,
  destinationUrl: typeof data.destinationUrl === 'string' ? data.destinationUrl : null,
  imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
  localeTargets: parseStringList(data.localeTargets, 16),
  pageTargets: parseStringList(data.pageTargets, 160).map(normalizePath),
  segmentTargets: parseAnnouncementSegments(data.segmentTargets),
  startAt: serializeTimestamp(data.startAt),
  endAt: serializeTimestamp(data.endAt),
  priority: typeof data.priority === 'number' ? data.priority : 0,
  dismissible: data.dismissible !== false,
  maxViewsPerVisitor:
    typeof data.maxViewsPerVisitor === 'number' && data.maxViewsPerVisitor > 0
      ? Math.min(Math.round(data.maxViewsPerVisitor), 50)
      : 1,
  sourceType: data.sourceType === 'auto_suggestion' ? 'auto_suggestion' : 'manual',
  sourceEntityType: parseSourceEntityType(data.sourceEntityType),
  sourceEntityId: typeof data.sourceEntityId === 'string' ? data.sourceEntityId : null,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  createdAt: serializeTimestamp(data.createdAt),
  updatedAt: serializeTimestamp(data.updatedAt),
});

export const serializePublicAnnouncementAnalytics = (
  announcementId: string,
  data: DocumentData,
): PublicAnnouncementAnalyticsSummary => {
  const impressions = typeof data.impressions === 'number' ? data.impressions : 0;
  const clicks = typeof data.clicks === 'number' ? data.clicks : 0;
  const dismissals = typeof data.dismissals === 'number' ? data.dismissals : 0;

  return {
    announcementId,
    impressions,
    clicks,
    dismissals,
    feedOpens: typeof data.feedOpens === 'number' ? data.feedOpens : 0,
    modalViews: typeof data.modalViews === 'number' ? data.modalViews : 0,
    bannerViews: typeof data.bannerViews === 'number' ? data.bannerViews : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    dismissRate: impressions > 0 ? dismissals / impressions : 0,
    lastImpressionAt: serializeTimestamp(data.lastImpressionAt),
    lastClickAt: serializeTimestamp(data.lastClickAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
};

export const buildAnnouncementWritePayload = (values: PublicAnnouncementFormValues) => {
  const startAt = parseDateValue(values.startAt);
  const endAt = parseDateValue(values.endAt);

  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error('End date must be after start date.');
  }

  const priority = values.priority === '' ? 0 : Number(values.priority);
  const maxViewsPerVisitor = values.maxViewsPerVisitor === '' ? 1 : Number(values.maxViewsPerVisitor);

  if (!Number.isFinite(priority)) {
    throw new Error('Priority must be a number.');
  }
  if (!Number.isFinite(maxViewsPerVisitor) || maxViewsPerVisitor < 1) {
    throw new Error('Max views per visitor must be at least 1.');
  }

  return {
    type: parseAnnouncementType(values.type),
    severity: parseAnnouncementSeverity(values.severity),
    status: parseAnnouncementStatus(values.status),
    displayMode: parseAnnouncementDisplayMode(values.displayMode),
    title: cleanRequiredText(values.title, 'Title', 140),
    summary: cleanRequiredText(values.summary, 'Summary', 280),
    body: cleanOptionalText(values.body, 2000),
    ctaLabel: cleanOptionalText(values.ctaLabel, 80),
    destinationUrl: cleanOptionalText(values.destinationUrl, 500),
    imageUrl: cleanOptionalText(values.imageUrl, 500),
    localeTargets: parseStringList(values.localeTargets, 16),
    pageTargets: parseStringList(values.pageTargets, 160).map(normalizePath),
    segmentTargets: parseAnnouncementSegments(values.segmentTargets),
    startAt,
    endAt,
    priority: Math.round(priority),
    dismissible: values.dismissible !== false,
    maxViewsPerVisitor: Math.min(Math.round(maxViewsPerVisitor), 50),
    sourceType: values.sourceType === 'auto_suggestion' ? 'auto_suggestion' as PublicAnnouncementSourceType : 'manual' as PublicAnnouncementSourceType,
    sourceEntityType: parseSourceEntityType(values.sourceEntityType),
    sourceEntityId: cleanOptionalText(values.sourceEntityId, 160),
  };
};

const pathMatchesTarget = (pagePath: string, target: string) => {
  if (target === '*') {
    return true;
  }
  if (target.endsWith('/*')) {
    const prefix = target.slice(0, -2);
    return pagePath === prefix || pagePath.startsWith(`${prefix}/`);
  }
  return pagePath === target || pagePath.startsWith(`${target}/`);
};

export const isAnnouncementPubliclyVisible = (
  announcement: PublicAnnouncement,
  input: { now: number; locale?: string | null; pagePath?: string | null; segment?: string | null },
) => {
  if (announcement.status !== 'active' && announcement.status !== 'scheduled') {
    return false;
  }

  const startAt = announcement.startAt ? Date.parse(announcement.startAt) : null;
  const endAt = announcement.endAt ? Date.parse(announcement.endAt) : null;
  if (startAt && startAt > input.now) {
    return false;
  }
  if (endAt && endAt <= input.now) {
    return false;
  }

  const locale = (input.locale ?? '').split('-')[0]?.toLowerCase() ?? '';
  if (announcement.localeTargets.length && locale && !announcement.localeTargets.includes(locale)) {
    return false;
  }

  const pagePath = normalizePath(input.pagePath || '/');
  if (announcement.pageTargets.length && !announcement.pageTargets.some(target => pathMatchesTarget(pagePath, target))) {
    return false;
  }

  const segment = input.segment || 'all';
  if (
    announcement.segmentTargets.length &&
    !announcement.segmentTargets.includes('all') &&
    !announcement.segmentTargets.includes(segment as PublicAnnouncementSegment)
  ) {
    return false;
  }

  return true;
};

export const sortPublicAnnouncements = <T extends PublicAnnouncement>(announcements: T[]) =>
  [...announcements].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    const leftTime = Date.parse(left.startAt ?? left.updatedAt ?? left.createdAt ?? '') || 0;
    const rightTime = Date.parse(right.startAt ?? right.updatedAt ?? right.createdAt ?? '') || 0;
    return rightTime - leftTime;
  });
