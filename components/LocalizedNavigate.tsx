import React from 'react';
import {
  Navigate as RouterNavigate,
  useLocation,
  type NavigateProps,
} from 'react-router-dom';
import { buildLocalizedTo, normalizeAppLocale, stripLocalePrefix } from '../utils/localizedRouting';

const LocalizedNavigate: React.FC<NavigateProps> = ({ to, ...rest }) => {
  const location = useLocation();
  const locale = normalizeAppLocale(stripLocalePrefix(location.pathname).locale);

  return <RouterNavigate to={buildLocalizedTo(to, locale)} {...rest} />;
};

export default LocalizedNavigate;
