import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeAppLocale, stripLocalePrefix } from '../utils/localizedRouting';

const LocalePathSync = () => {
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    const localeFromPath = normalizeAppLocale(stripLocalePrefix(location.pathname).locale);

    if (normalizeAppLocale(i18n.resolvedLanguage || i18n.language) !== localeFromPath) {
      void i18n.changeLanguage(localeFromPath);
    }
  }, [i18n, location.pathname]);

  return null;
};

export default LocalePathSync;
