import type { DocumentData } from 'firebase-admin/firestore';
import type {
  NewsletterProviderSyncStatus,
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
} from '../../../types';
import { serializeTimestamp } from './placements';

export const NEWSLETTER_SUBSCRIBER_STATUSES: readonly NewsletterSubscriberStatus[] = [
  'active',
  'unsubscribed',
  'bounced',
];

export const NEWSLETTER_PROVIDER_SYNC_STATUSES: readonly NewsletterProviderSyncStatus[] = [
  'not_configured',
  'synced',
  'failed',
];

export const buildNewsletterSubscriberId = (email: string) =>
  Buffer.from(email.trim().toLowerCase(), 'utf8').toString('base64url');

export const parseNewsletterSubscriberStatus = (value: unknown): NewsletterSubscriberStatus =>
  (NEWSLETTER_SUBSCRIBER_STATUSES as readonly string[]).includes(String(value))
    ? (value as NewsletterSubscriberStatus)
    : 'active';

export const parseNewsletterProviderSyncStatus = (value: unknown): NewsletterProviderSyncStatus =>
  (NEWSLETTER_PROVIDER_SYNC_STATUSES as readonly string[]).includes(String(value))
    ? (value as NewsletterProviderSyncStatus)
    : 'not_configured';

export const serializeNewsletterSubscriber = (
  id: string,
  data: DocumentData,
): NewsletterSubscriber => ({
  id,
  email: typeof data.email === 'string' ? data.email : '',
  name: typeof data.name === 'string' && data.name ? data.name : null,
  locale: typeof data.locale === 'string' && data.locale ? data.locale : null,
  pagePath: typeof data.pagePath === 'string' && data.pagePath ? data.pagePath : null,
  source: typeof data.source === 'string' && data.source ? data.source : 'footer-newsletter',
  status: parseNewsletterSubscriberStatus(data.status),
  providerName: typeof data.providerName === 'string' && data.providerName ? data.providerName : null,
  providerSyncStatus: parseNewsletterProviderSyncStatus(data.providerSyncStatus),
  providerSubscriberId:
    typeof data.providerSubscriberId === 'string' && data.providerSubscriberId
      ? data.providerSubscriberId
      : null,
  providerError: typeof data.providerError === 'string' && data.providerError ? data.providerError : null,
  consentAt: serializeTimestamp(data.consentAt),
  createdAt: serializeTimestamp(data.createdAt),
  updatedAt: serializeTimestamp(data.updatedAt),
});
