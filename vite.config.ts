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
      test: {
        environment: 'node',
        restoreMocks: true,
      }
    };
});
