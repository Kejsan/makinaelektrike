import { FieldValue } from 'firebase-admin/firestore';
import type { FunctionEvent } from './_lib/http';
import {
  badRequest,
  internalError,
  json,
  methodNotAllowed,
  serviceUnavailable,
  withTimeout,
} from './_lib/http';
import { getOptionalString, getRequiredString } from './_lib/validation';
import { getAdminFirestore } from './_lib/firebaseAdmin';

interface CreateEnquiryBody {
  listingId?: string;
  dealerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as CreateEnquiryBody) : {};
    const listingId = getRequiredString(body.listingId, 'listingId', 128);
    const dealerId = getRequiredString(body.dealerId, 'dealerId', 128);
    const name = getRequiredString(body.name, 'name', 120);
    const email = getRequiredString(body.email, 'email', 254);
    const phone = getOptionalString(body.phone, { field: 'phone', maxLength: 40 });
    const message = getRequiredString(body.message, 'message', 5000);

    const firestore = getAdminFirestore();
    const listingSnapshot = await withTimeout(
      firestore.collection('listings').doc(listingId).get(),
      8000,
      'Listing lookup timed out.',
    );

    if (!listingSnapshot.exists) {
      return badRequest('listingId is invalid.');
    }

    const listing = listingSnapshot.data() as
      | {
          dealerId?: string;
          status?: string;
        }
      | undefined;

    if (!listing || listing.dealerId !== dealerId) {
      return badRequest('dealerId does not match the selected listing.');
    }

    if (listing.status !== 'approved' && listing.status !== 'active') {
      return badRequest('This listing is not accepting public enquiries.');
    }

    await withTimeout(
      firestore.collection('enquiries').add({
        listingId,
        dealerId,
        name,
        email,
        phone: phone ?? '',
        message,
        status: 'new',
        source: 'public-listing',
        createdAt: FieldValue.serverTimestamp(),
        userAgent: event.headers?.['user-agent'] ?? '',
      }),
      8000,
      'Saving the enquiry timed out.',
    );

    return json(201, { ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side enquiries are not configured.');
    }
    if (message.includes('required') || message.includes('characters')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
