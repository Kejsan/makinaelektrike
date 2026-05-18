import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import sqTranslations from './locales/sq.json';
import itTranslations from './locales/it.json';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeAppLocale,
  stripLocalePrefix,
} from '../utils/localizedRouting';

const resources = {
  en: { translation: enTranslations },
  sq: { translation: sqTranslations },
  it: { translation: itTranslations },
};

const initialLanguage =
  typeof window !== 'undefined'
    ? normalizeAppLocale(stripLocalePrefix(window.location.pathname).locale)
    : DEFAULT_LOCALE;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
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

i18n.on('languageChanged', lng => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export default i18n;
