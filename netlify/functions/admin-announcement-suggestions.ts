import type { DocumentData } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  forbidden,
  internalError,
  json,
  methodNotAllowed,
  quotaExceeded,
  serviceUnavailable,
  unauthorized,
} from './_lib/http';
import { requireAdminPermission } from './_lib/adminAccess';
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import type { PublicAnnouncementFormValues } from '../../types';

const baseSuggestion = (
  values: Partial<PublicAnnouncementFormValues>,
): PublicAnnouncementFormValues => ({
  type: 'platform_notice',
  severity: 'info',
  status: 'draft',
  displayMode: 'feed_only',
  title: '',
  summary: '',
  body: '',
  ctaLabel: '',
  destinationUrl: '',
  imageUrl: '',
  localeTargets: [],
  pageTargets: [],
  segmentTargets: ['all'],
  startAt: '',
  endAt: '',
  priority: 0,
  dismissible: true,
  maxViewsPerVisitor: 1,
  sourceType: 'auto_suggestion',
  sourceEntityType: '',
  sourceEntityId: '',
  ...values,
});

const readTitle = (data: DocumentData, keys: string[]) => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    await requireAdminPermission(event, 'announcements.create');
    const firestore = getAdminFirestore();

    const [dealerSnapshot, blogSnapshot, modelSnapshot, stationSnapshot] = await Promise.all([
      firestore.collection('dealers').orderBy('updatedAt', 'desc').limit(8).get(),
      firestore.collection('blogPosts').orderBy('updatedAt', 'desc').limit(8).get(),
      firestore.collection('models').orderBy('updatedAt', 'desc').limit(12).get(),
      firestore.collection('charging_stations').orderBy('updatedAt', 'desc').limit(8).get(),
    ]);

    const suggestions: PublicAnnouncementFormValues[] = [];

    dealerSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.approved !== true || data.isActive === false || data.isDeleted === true) {
        return;
      }
      const name = readTitle(data, ['name', 'companyName']);
      suggestions.push(baseSuggestion({
        type: 'dealer_added',
        severity: 'highlight',
        displayMode: 'banner',
        title: name ? `New verified dealer: ${name}` : 'New verified EV dealer added',
        summary: name
          ? `${name} is now available in the Makina Elektrike dealer network.`
          : 'A new verified EV dealer is now available on the platform.',
        ctaLabel: 'View dealer',
        destinationUrl: `/dealers/${doc.id}`,
        pageTargets: ['/', '/dealers'],
        priority: 30,
        sourceEntityType: 'dealer',
        sourceEntityId: doc.id,
      }));
    });

    blogSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.published === false || data.status === 'draft') {
        return;
      }
      const title = readTitle(data, ['title']);
      const slug = readTitle(data, ['slug']) || doc.id;
      suggestions.push(baseSuggestion({
        type: 'blog_post',
        title: title ? `New guide: ${title}` : 'New EV guide published',
        summary: typeof data.excerpt === 'string' && data.excerpt.trim()
          ? data.excerpt.trim().slice(0, 220)
          : 'A new editorial guide is available for EV shoppers in Albania.',
        ctaLabel: 'Read guide',
        destinationUrl: `/blog/${slug}`,
        pageTargets: ['/', '/blog'],
        priority: 18,
        sourceEntityType: 'blog_post',
        sourceEntityId: doc.id,
      }));
    });

    const publicModels = modelSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.isActive !== false && (data.reviewStatus === undefined || data.reviewStatus === 'approved');
      })
      .slice(0, 6);
    if (publicModels.length >= 3) {
      const brands = Array.from(new Set(publicModels.map(doc => readTitle(doc.data(), ['brand'])).filter(Boolean))).slice(0, 4);
      suggestions.push(baseSuggestion({
        type: 'model_batch',
        severity: 'highlight',
        displayMode: 'banner',
        title: `${publicModels.length} new EV model cards added`,
        summary: brands.length
          ? `Fresh EV model data is available across ${brands.join(', ')} and more.`
          : 'Fresh EV model data is available in the platform catalog.',
        ctaLabel: 'Browse models',
        destinationUrl: '/models',
        pageTargets: ['/', '/models'],
        priority: 24,
        sourceEntityType: 'model',
        sourceEntityId: publicModels[0]?.id ?? '',
      }));
    }

    stationSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.isActive === false) {
        return;
      }
      const title = readTitle(data, ['address', 'operator']);
      suggestions.push(baseSuggestion({
        type: 'charging_update',
        title: title ? `Charging location updated: ${title}` : 'Charging map updated',
        summary: 'Charging station information has been refreshed to help visitors plan routes with more confidence.',
        ctaLabel: 'Open charging map',
        destinationUrl: '/albania-charging-stations',
        pageTargets: ['/', '/albania-charging-stations'],
        priority: 15,
        sourceEntityType: 'charging_station',
        sourceEntityId: doc.id,
      }));
    });

    return json(200, {
      ok: true,
      suggestions: suggestions.slice(0, 16),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.startsWith('Missing authorization') || message.startsWith('Authorization header')) {
      return unauthorized(message);
    }
    if (message.startsWith('Missing required permission') || message.startsWith('Authenticated admin profile')) {
      return forbidden(message);
    }
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side announcement suggestions are not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so announcement suggestions are temporarily unavailable.');
    }

    return internalError(message);
  }
};
