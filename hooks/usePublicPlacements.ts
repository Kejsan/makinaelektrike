import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicPlacementZoneResult } from '../types';
import { normalizeAppLocale } from '../utils/localizedRouting';
import { resolvePublicPlacements } from '../services/publicPlacements';

interface UsePublicPlacementsState {
  zones: PublicPlacementZoneResult[];
  loading: boolean;
  error: string | null;
}

export const usePublicPlacements = (zoneKeys: string[]) => {
  const { i18n } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language);
  const requestedZoneKeys = zoneKeys.join('|');
  const normalizedZoneKeys = useMemo(
    () =>
      Array.from(
        new Set(
          zoneKeys
            .map(zoneKey => zoneKey.trim().toLowerCase())
            .filter(zoneKey => zoneKey.length > 0),
        ),
      ),
    [requestedZoneKeys],
  );
  const zoneSignature = normalizedZoneKeys.join('|');
  const [state, setState] = useState<UsePublicPlacementsState>({
    zones: [],
    loading: normalizedZoneKeys.length > 0,
    error: null,
  });

  useEffect(() => {
    if (!normalizedZoneKeys.length) {
      setState({
        zones: [],
        loading: false,
        error: null,
      });
      return;
    }

    const controller = new AbortController();
    setState(current => ({
      zones: current.zones,
      loading: true,
      error: null,
    }));

    resolvePublicPlacements(normalizedZoneKeys, locale, controller.signal)
      .then(response => {
        setState({
          zones: response.zones,
          loading: false,
          error: null,
        });
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Failed to resolve public placements:', error);
        setState({
          zones: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to resolve public placements.',
        });
      });

    return () => controller.abort();
  }, [locale, zoneSignature]);

  const zonesByKey = useMemo(() => {
    const map = new Map<string, PublicPlacementZoneResult>();
    state.zones.forEach(zone => {
      map.set(zone.zoneKey, zone);
    });
    return map;
  }, [state.zones]);

  return {
    zones: state.zones,
    zonesByKey,
    loading: state.loading,
    error: state.error,
  };
};
