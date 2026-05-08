import type { AppLocale } from '../utils/localizedRouting';
import type { PublicPlacementResolveResponse } from '../types';
import { fetchFunctionJson } from './serverFunctions';

export const resolvePublicPlacements = async (
  zoneKeys: string[],
  locale: AppLocale,
  signal?: AbortSignal,
) =>
  fetchFunctionJson<PublicPlacementResolveResponse>('public-placement-resolve', {
    query: {
      zones: zoneKeys,
      locale,
    },
    signal,
  });
