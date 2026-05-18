import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  NewsletterSubscribeResponse,
  NewsletterSubscriberListResponse,
} from '../types';

export const subscribeToNewsletter = async (payload: {
  email: string;
  name?: string;
  consent: boolean;
  locale?: string;
  pagePath?: string;
  company?: string;
}) =>
  fetchFunctionJson<NewsletterSubscribeResponse, typeof payload>('newsletter-subscribe', {
    method: 'POST',
    body: payload,
  });

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to view newsletter subscribers.');
  }

  return currentUser.getIdToken();
};

export const listAdminNewsletterSubscribers = async (limit = 200) => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<NewsletterSubscriberListResponse>('admin-newsletter-subscriber-list', {
    method: 'GET',
    query: { limit },
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};
