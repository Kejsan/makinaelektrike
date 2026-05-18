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
import { getAdminFirestore } from './_lib/firebaseAdmin';
import { isFirestoreQuotaError } from './_lib/firebaseErrors';
import { getOptionalBoolean, getOptionalString, getRequiredEmail } from './_lib/validation';
import {
  buildNewsletterSubscriberId,
  serializeNewsletterSubscriber,
} from './_lib/newsletterSubscribers';

interface NewsletterSubscribeBody {
  email?: string;
  name?: string;
  consent?: boolean | string;
  locale?: string;
  pagePath?: string;
  company?: string;
}

type ProviderSyncResult =
  | {
      status: 'not_configured';
      providerName: null;
      providerSubscriberId: null;
      error: null;
    }
  | {
      status: 'synced';
      providerName: string;
      providerSubscriberId: string | null;
      error: null;
    }
  | {
      status: 'failed';
      providerName: string;
      providerSubscriberId: null;
      error: string;
    };

const readProviderSubscriberId = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const id = payload.id ?? payload.subscriberId ?? payload.contactId;
  return typeof id === 'string' && id.trim() ? id.trim().slice(0, 160) : null;
};

const syncNewsletterProvider = async (payload: {
  email: string;
  name?: string;
  locale?: string;
  pagePath?: string;
  source: string;
  userAgent: string;
}): Promise<ProviderSyncResult> => {
  const webhookUrl = process.env.NEWSLETTER_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      status: 'not_configured',
      providerName: null,
      providerSubscriberId: null,
      error: null,
    };
  }

  const providerName = process.env.NEWSLETTER_PROVIDER_NAME?.trim() || 'newsletter webhook';
  const secret = process.env.NEWSLETTER_WEBHOOK_SECRET?.trim();

  try {
    const response = await withTimeout(
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({
          ...payload,
          consent: true,
          consentAt: new Date().toISOString(),
        }),
      }),
      6000,
      'Newsletter provider sync timed out.',
    );

    const text = await response.text();
    let parsed: unknown = null;
    if (text.trim()) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      return {
        status: 'failed',
        providerName,
        providerSubscriberId: null,
        error: (text.trim() || response.statusText).slice(0, 500),
      };
    }

    return {
      status: 'synced',
      providerName,
      providerSubscriberId: readProviderSubscriberId(parsed),
      error: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      providerName,
      providerSubscriberId: null,
      error: error instanceof Error ? error.message.slice(0, 500) : 'Newsletter provider sync failed.',
    };
  }
};

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  try {
    const body = event.body ? (JSON.parse(event.body) as NewsletterSubscribeBody) : {};
    const honeypot = getOptionalString(body.company, { field: 'company', maxLength: 120 });
    if (honeypot) {
      return json(200, { ok: true });
    }

    const email = getRequiredEmail(body.email);
    const name = getOptionalString(body.name, { field: 'name', maxLength: 120 });
    const locale = getOptionalString(body.locale, { field: 'locale', maxLength: 12 });
    const pagePath = getOptionalString(body.pagePath, { field: 'pagePath', maxLength: 255 });
    const consent = getOptionalBoolean(body.consent);
    if (consent !== true) {
      return badRequest('Consent is required to subscribe to newsletter updates.');
    }

    const source = 'footer-newsletter';
    const provider = await syncNewsletterProvider({
      email,
      name,
      locale,
      pagePath,
      source,
      userAgent: event.headers?.['user-agent'] ?? '',
    });

    const firestore = getAdminFirestore();
    const docRef = firestore.collection('newsletterSubscribers').doc(buildNewsletterSubscriberId(email));
    const snapshot = await withTimeout(docRef.get(), 8000, 'Loading subscriber record timed out.');
    const now = FieldValue.serverTimestamp();

    await withTimeout(
      docRef.set(
        {
          email,
          name: name ?? '',
          locale: locale ?? '',
          pagePath: pagePath ?? '',
          source,
          status: 'active',
          providerName: provider.providerName ?? '',
          providerSyncStatus: provider.status,
          providerSubscriberId: provider.providerSubscriberId ?? '',
          providerError: provider.error ?? '',
          consentAt: now,
          createdAt: snapshot.exists ? snapshot.data()?.createdAt ?? now : now,
          updatedAt: now,
          userAgent: event.headers?.['user-agent'] ?? '',
        },
        { merge: true },
      ),
      8000,
      'Saving newsletter subscription timed out.',
    );

    const savedSnapshot = await withTimeout(docRef.get(), 8000, 'Loading saved subscription timed out.');
    const subscriber = serializeNewsletterSubscriber(docRef.id, savedSnapshot.data() ?? {});

    return json(201, {
      ok: true,
      subscriber,
      providerSyncStatus: provider.status,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith('Missing Firebase admin credentials')) {
      return serviceUnavailable('Server-side newsletter subscriptions are not configured.');
    }
    if (isFirestoreQuotaError(error)) {
      return serviceUnavailable('Newsletter subscriptions are temporarily unavailable because the database quota is exhausted.');
    }
    if (
      message.includes('required') ||
      message.includes('characters') ||
      message.includes('valid email') ||
      message.includes('Boolean value')
    ) {
      return badRequest(message);
    }
    return internalError(message);
  }
};
