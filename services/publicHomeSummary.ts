import type { BlogPost, Dealer, Listing, Model } from '../types';
import { fetchFunctionJson, isFunctionHtmlResponseError, isFunctionQuotaExceededError } from './serverFunctions';

export interface PublicHomeSummary {
  dealers: Dealer[];
  models: Model[];
  listings: Listing[];
  blogPosts: BlogPost[];
}

interface PublicHomeSummaryResponse extends PublicHomeSummary {
  ok: true;
}

export const getPublicHomeSummary = async (signal?: AbortSignal): Promise<PublicHomeSummary | null> => {
  try {
    const response = await fetchFunctionJson<PublicHomeSummaryResponse>('public-home-summary', {
      method: 'GET',
      signal,
    });

    return {
      dealers: response.dealers ?? [],
      models: response.models ?? [],
      listings: response.listings ?? [],
      blogPosts: response.blogPosts ?? [],
    };
  } catch (error) {
    if (isFunctionHtmlResponseError(error) || isFunctionQuotaExceededError(error)) {
      return null;
    }

    throw error;
  }
};
