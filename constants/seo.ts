import { DEFAULT_OG_IMAGE_PATH } from '../data/blogImages';

const { VITE_SITE_URL } = import.meta.env;

const DEFAULT_BASE_URL = 'https://makinaelektrike.com';

export const BASE_URL = (VITE_SITE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
export const DEFAULT_OG_IMAGE = `${BASE_URL}${DEFAULT_OG_IMAGE_PATH}`;
