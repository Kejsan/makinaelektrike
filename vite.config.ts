import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { netlifyFunctionsPlugin } from './dev/netlifyFunctionsPlugin';

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, '.', '');
    Object.entries(env).forEach(([key, value]) => {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      envPrefix: ['VITE_'],
      plugins: [react(), ...(command === 'serve' ? [netlifyFunctionsPlugin()] : [])],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              const normalizedId = id.split(path.sep).join('/');

              if (normalizedId.includes('/node_modules/')) {
                if (
                  normalizedId.includes('/node_modules/react/') ||
                  normalizedId.includes('/node_modules/react-dom/') ||
                  normalizedId.includes('/node_modules/react-router-dom/')
                ) {
                  return 'vendor-react';
                }

                if (
                  normalizedId.includes('/node_modules/firebase/') ||
                  normalizedId.includes('/node_modules/@firebase/')
                ) {
                  if (
                    normalizedId.includes('/node_modules/firebase/auth/') ||
                    normalizedId.includes('/node_modules/@firebase/auth/')
                  ) {
                    return 'vendor-firebase-auth';
                  }

                  if (
                    normalizedId.includes('/node_modules/firebase/firestore/') ||
                    normalizedId.includes('/node_modules/@firebase/firestore/')
                  ) {
                    return 'vendor-firebase-firestore';
                  }

                  if (
                    normalizedId.includes('/node_modules/firebase/storage/') ||
                    normalizedId.includes('/node_modules/@firebase/storage/')
                  ) {
                    return 'vendor-firebase-storage';
                  }

                  if (
                    normalizedId.includes('/node_modules/firebase/analytics/') ||
                    normalizedId.includes('/node_modules/@firebase/analytics/')
                  ) {
                    return 'vendor-firebase-analytics';
                  }

                  return 'vendor-firebase-core';
                }

                if (
                  normalizedId.includes('/node_modules/i18next/') ||
                  normalizedId.includes('/node_modules/react-i18next/') ||
                  normalizedId.includes('/node_modules/i18next-browser-languagedetector/')
                ) {
                  return 'vendor-i18n';
                }

                if (normalizedId.includes('/node_modules/lucide-react/')) {
                  return 'vendor-ui';
                }

                if (
                  normalizedId.includes('/node_modules/leaflet/') ||
                  normalizedId.includes('/node_modules/leaflet.markercluster/') ||
                  normalizedId.includes('/node_modules/@react-google-maps/api/')
                ) {
                  return 'vendor-maps';
                }

                if (
                  normalizedId.includes('/node_modules/papaparse/') ||
                  normalizedId.includes('/node_modules/xlsx/')
                ) {
                  return 'vendor-admin-data';
                }
              }

              if (normalizedId.includes('/i18n/locales/')) {
                return 'content-locales';
              }

              if (normalizedId.endsWith('/data/blogPosts.ts')) {
                return 'content-blog-posts';
              }

              if (normalizedId.endsWith('/data/helpCenterContent.ts')) {
                return 'content-help-center';
              }
            },
          },
        },
      },
      test: {
        environment: 'node',
        restoreMocks: true,
      }
    };
});
