import type { FunctionEvent } from './_lib/http';
import {
  internalError,
  json,
  methodNotAllowed,
  quotaExceeded,
  serviceUnavailable,
} from './_lib/http';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import { getAdminFirestore } from './_lib/firebaseAdmin';

const take = <T>(items: T[], count: number) => items.slice(0, count);

const clean = <T extends Record<string, unknown>>(item: T) =>
  Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const db = getAdminFirestore();
    const [dealersSnapshot, modelsSnapshot, listingsSnapshot, blogSnapshot] = await Promise.all([
      db.collection('dealers').where('approved', '==', true).where('isActive', '==', true).get(),
      db.collection('models').get(),
      db.collection('listings').where('status', '==', 'approved').get(),
      db.collection('blogPosts').get(),
    ]);

    const dealers = dealersSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(dealer => dealer.isDeleted !== true)
      .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || String(a.name ?? '').localeCompare(String(b.name ?? '')));

    const models = modelsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(model => model.isActive !== false && !['draft', 'pending_review', 'rejected'].includes(String(model.reviewStatus ?? 'approved')))
      .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || String(a.brand ?? '').localeCompare(String(b.brand ?? '')));

    const listings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const blogPosts = blogSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(post => post.published !== false && post.status !== 'draft')
      .sort((a, b) => new Date(String(b.date ?? '')).getTime() - new Date(String(a.date ?? '')).getTime());

    return json(
      200,
      {
        ok: true,
        dealers: take(dealers, 24).map(dealer =>
          clean({
            id: dealer.id,
            name: dealer.name,
            city: dealer.city,
            location: dealer.location,
            brands: dealer.brands,
            logo_url: dealer.logo_url,
            image_url: dealer.image_url,
            imageGallery: dealer.imageGallery,
            isFeatured: dealer.isFeatured,
            approved: dealer.approved,
            status: dealer.status,
            isActive: dealer.isActive,
          }),
        ),
        models: take(models, 16).map(model =>
          clean({
            id: model.id,
            brand: model.brand,
            model_name: model.model_name,
            image_url: model.image_url,
            imageGallery: model.imageGallery,
            isFeatured: model.isFeatured,
            body_type: model.body_type,
            ownerDealerId: model.ownerDealerId,
            battery_capacity: model.battery_capacity,
            range_wltp: model.range_wltp,
          }),
        ),
        listings: take(listings, 12).map(listing =>
          clean({
            id: listing.id,
            make: listing.make,
            model: listing.model,
            status: listing.status,
          }),
        ),
        blogPosts: take(blogPosts, 6).map(post => clean(post)),
      },
      {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
      },
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Public home data is not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return quotaExceeded('Firestore quota is exhausted, so public home data is temporarily unavailable.');
    }

    return internalError(message);
  }
};
