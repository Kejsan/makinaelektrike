import { useEffect, useState } from 'react';
import type { BlogPost, Dealer, Listing, Model } from '../types';
import staticBlogPosts from '../data/blogPosts';
import { getPublicHomeSummary } from '../services/publicHomeSummary';

interface PublicHomeSummaryState {
  dealers: Dealer[];
  models: Model[];
  listings: Listing[];
  blogPosts: BlogPost[];
  loading: boolean;
  error: string | null;
}

const fallbackState: Omit<PublicHomeSummaryState, 'loading' | 'error'> = {
  dealers: [],
  models: [],
  listings: [],
  blogPosts: staticBlogPosts.slice(0, 3),
};

export const usePublicHomeSummary = () => {
  const [state, setState] = useState<PublicHomeSummaryState>({
    ...fallbackState,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    getPublicHomeSummary(controller.signal)
      .then(summary => {
        if (!summary) {
          setState({ ...fallbackState, loading: false, error: null });
          return;
        }

        setState({
          dealers: summary.dealers,
          models: summary.models,
          listings: summary.listings,
          blogPosts: summary.blogPosts.length ? summary.blogPosts : fallbackState.blogPosts,
          loading: false,
          error: null,
        });
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }

        console.error('Failed to load public home summary:', error);
        setState({
          ...fallbackState,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load public home data.',
        });
      });

    return () => controller.abort();
  }, []);

  return state;
};
