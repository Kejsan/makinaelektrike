import type { AppLocale } from '../utils/localizedRouting';
import type { PublicPlacementResolveResponse } from '../types';
import { fetchFunctionJson, isFunctionHtmlResponseError } from './serverFunctions';

export const resolvePublicPlacements = async (
  zoneKeys: string[],
  locale: AppLocale,
  signal?: AbortSignal,
) => {
  try {
    return await fetchFunctionJson<PublicPlacementResolveResponse>('public-placement-resolve', {
      query: {
        zones: zoneKeys,
        locale,
      },
      signal,
    });
  } catch (error) {
    if (isFunctionHtmlResponseError(error)) {
      return { zones: [] };
    }

    throw error;
  }
};
