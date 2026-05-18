import { fetchFunctionJson } from './serverFunctions';
import type { PublicAnnouncementResolveResponse } from '../types';

export const resolvePublicAnnouncements = async (input: {
  locale?: string | null;
  pagePath?: string | null;
  segment?: string | null;
  signal?: AbortSignal;
}) =>
  fetchFunctionJson<PublicAnnouncementResolveResponse>('public-announcement-resolve', {
    method: 'GET',
    query: {
      locale: input.locale ?? undefined,
      pagePath: input.pagePath ?? undefined,
      segment: input.segment ?? undefined,
    },
    signal: input.signal,
  });
