import React from 'react';
import {
  Link as RouterLink,
  type LinkProps,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildLocalizedTo, normalizeAppLocale } from '../utils/localizedRouting';

const LocalizedLink = React.forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
  const { i18n } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language);

  return <RouterLink ref={ref} {...props} to={buildLocalizedTo(props.to, locale)} />;
});

LocalizedLink.displayName = 'LocalizedLink';

export default LocalizedLink;
