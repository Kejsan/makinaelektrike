import React from 'react';
import {
  Link as RouterLink,
  useLocation,
  type LinkProps,
} from 'react-router-dom';
import { buildLocalizedTo, normalizeAppLocale, stripLocalePrefix } from '../utils/localizedRouting';

const LocalizedLink = React.forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
  const location = useLocation();
  const locale = normalizeAppLocale(stripLocalePrefix(location.pathname).locale);

  return <RouterLink ref={ref} {...props} to={buildLocalizedTo(props.to, locale)} />;
});

LocalizedLink.displayName = 'LocalizedLink';

export default LocalizedLink;
