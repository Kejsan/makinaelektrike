import type { PublicSiteSettings } from '../types';
import {
  FunctionJsonResponseError,
  fetchFunctionJson,
  isFunctionHtmlResponseError,
  isFunctionQuotaExceededError,
} from './serverFunctions';

interface PublicSiteSettingsResponse {
  ok: true;
  settings: PublicSiteSettings;
}

export const getPublicSiteSettings = async (signal?: AbortSignal) => {
  try {
    const response = await fetchFunctionJson<PublicSiteSettingsResponse>('public-site-settings', {
      method: 'GET',
      signal,
    });

    return response.settings;
  } catch (error) {
    if (
      isFunctionHtmlResponseError(error) ||
      isFunctionQuotaExceededError(error) ||
      error instanceof FunctionJsonResponseError
    ) {
      return null;
    }

    throw error;
  }
};
