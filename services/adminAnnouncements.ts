import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type {
  PublicAnnouncement,
  PublicAnnouncementFormValues,
  PublicAnnouncementListResponse,
} from '../types';

interface AnnouncementSaveResponse {
  ok: true;
  announcement: PublicAnnouncement;
}

interface AnnouncementSuggestionsResponse {
  ok: true;
  suggestions: PublicAnnouncementFormValues[];
  generatedAt: string;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to manage public announcements.');
  }

  return currentUser.getIdToken();
};

const withAdminAuth = async <TResponse, TBody = unknown>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST';
    body?: TBody;
  } = {},
) => {
  const idToken = await getRequiredIdToken();
  return fetchFunctionJson<TResponse, TBody>(functionName, {
    method: options.method,
    body: options.body,
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
};

export const listAdminAnnouncements = async () =>
  withAdminAuth<PublicAnnouncementListResponse>('admin-announcement-list', {
    method: 'GET',
  });

export const saveAdminAnnouncement = async (payload: {
  id?: string;
  values: PublicAnnouncementFormValues;
}) =>
  withAdminAuth<AnnouncementSaveResponse, typeof payload>('admin-announcement-save', {
    method: 'POST',
    body: payload,
  });

export const archiveAdminAnnouncement = async (id: string) =>
  withAdminAuth<AnnouncementSaveResponse, { id: string }>('admin-announcement-archive', {
    method: 'POST',
    body: { id },
  });

export const listAdminAnnouncementSuggestions = async () =>
  withAdminAuth<AnnouncementSuggestionsResponse>('admin-announcement-suggestions', {
    method: 'GET',
  });
