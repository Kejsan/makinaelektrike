import { useCallback } from 'react';
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
  type To,
} from 'react-router-dom';
import { buildLocalizedTo, normalizeAppLocale, stripLocalePrefix } from '../utils/localizedRouting';

const useLocalizedNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = normalizeAppLocale(stripLocalePrefix(location.pathname).locale);

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      navigate(buildLocalizedTo(to, locale), options);
    },
    [locale, navigate],
  );
};

export default useLocalizedNavigate;
