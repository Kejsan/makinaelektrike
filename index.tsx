import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './src/index.css';
import './i18n/config';
import { SITE_ICON } from './constants/media';

const ensureFavicon = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const faviconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (faviconLink) {
    faviconLink.type = 'image/png';
    faviconLink.href = SITE_ICON;
    return;
  }

  const newFavicon = document.createElement('link');
  newFavicon.rel = 'icon';
  newFavicon.type = 'image/png';
  newFavicon.href = SITE_ICON;
  document.head.appendChild(newFavicon);
};

ensureFavicon();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
