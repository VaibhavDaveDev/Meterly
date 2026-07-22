import { defineConfig } from 'vitest/config';
import react from '@astrojs/react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'cloudflare:workers': path.resolve(__dirname, 'src/test/mocks/cloudflare-workers.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    server: {
      deps: {
        inline: [/@microlabs\/otel-cf-workers/]
      }
    }
  },
});
