import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';
import type { PublicSiteSettings } from '../types';

interface AdminSiteSettingsResponse {
  ok: true;
  settings: PublicSiteSettings;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to manage site settings.');
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

export const getAdminSiteSettings = async () =>
  withAdminAuth<AdminSiteSettingsResponse>('admin-site-settings-get', {
    method: 'GET',
  });

export const saveAdminSiteSettings = async (settings: PublicSiteSettings) =>
  withAdminAuth<AdminSiteSettingsResponse, { settings: PublicSiteSettings }>(
    'admin-site-settings-save',
    {
      method: 'POST',
      body: { settings },
    },
  );
