import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeAppLocale,
  stripLocalePrefix,
} from '../utils/localizedRouting';

const localeLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en.json'),
  sq: () => import('./locales/sq.json'),
  it: () => import('./locales/it.json'),
};

const initialLanguage =
  typeof window !== 'undefined'
    ? normalizeAppLocale(stripLocalePrefix(window.location.pathname).locale)
    : DEFAULT_LOCALE;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {},
    lng: initialLanguage,
    supportedLngs: [...SUPPORTED_LOCALES],
    fallbackLng: DEFAULT_LOCALE,
    load: 'languageOnly',
    cleanCode: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
    },
  })
  .then(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = i18n.language;
    }
  });

i18n.on('languageChanging', lng => {
  const locale = normalizeAppLocale(lng);
  if (i18n.hasResourceBundle(locale, 'translation')) {
    return;
  }

  void localeLoaders[locale]().then(module => {
    i18n.addResourceBundle(locale, 'translation', module.default, true, true);
  });
});

i18n.on('languageChanged', lng => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

void localeLoaders[initialLanguage]().then(module => {
  i18n.addResourceBundle(initialLanguage, 'translation', module.default, true, true);
  if (initialLanguage !== DEFAULT_LOCALE && !i18n.hasResourceBundle(DEFAULT_LOCALE, 'translation')) {
    void localeLoaders[DEFAULT_LOCALE]().then(fallbackModule => {
      i18n.addResourceBundle(DEFAULT_LOCALE, 'translation', fallbackModule.default, true, true);
    });
  }
});

export default i18n;
