import { useEffect, useState } from 'react';
import type { PublicSiteSettings } from '../types';
import { DEFAULT_SITE_SETTINGS, mergeSiteSettings } from '../constants/siteSettings';
import { getPublicSiteSettings } from '../services/siteSettings';

interface SiteSettingsState {
  settings: PublicSiteSettings;
  loading: boolean;
  error: string | null;
}

export const useSiteSettings = () => {
  const [state, setState] = useState<SiteSettingsState>({
    settings: DEFAULT_SITE_SETTINGS,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    getPublicSiteSettings(controller.signal)
      .then(settings => {
        setState({
          settings: mergeSiteSettings(settings),
          loading: false,
          error: null,
        });
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Failed to load public site settings:', error);
        setState({
          settings: DEFAULT_SITE_SETTINGS,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load site settings.',
        });
      });

    return () => controller.abort();
  }, []);

  return state;
};
