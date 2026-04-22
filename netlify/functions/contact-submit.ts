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

interface ContactSubmitBody {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  company?: string;
  locale?: string;
  pagePath?: string;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as ContactSubmitBody) : {};
    const honeypot = getOptionalString(body.company, { field: 'company', maxLength: 120 });
    if (honeypot) {
      return json(200, { ok: true });
    }

    const name = getRequiredString(body.name, 'name', 120);
    const email = getRequiredString(body.email, 'email', 254);
    const phone = getOptionalString(body.phone, { field: 'phone', maxLength: 40 });
    const message = getRequiredString(body.message, 'message', 5000);
    const locale = getOptionalString(body.locale, { field: 'locale', maxLength: 12 });
    const pagePath = getOptionalString(body.pagePath, { field: 'pagePath', maxLength: 255 });

    const firestore = getAdminFirestore();
    await withTimeout(
      firestore.collection('contactMessages').add({
        name,
        email,
        phone: phone ?? '',
        message,
        locale: locale ?? '',
        pagePath: pagePath ?? '',
        source: 'contact-page',
        status: 'new',
        createdAt: FieldValue.serverTimestamp(),
        userAgent: event.headers?.['user-agent'] ?? '',
      }),
      8000,
      'Saving the contact message timed out.',
    );

    return json(201, { ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side contact submissions are not configured.');
    }
    if (message.includes('required') || message.includes('characters')) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
