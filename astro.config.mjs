import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: 'passthrough',
  }),
  integrations: [react(), tailwind()],
  vite: {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
            dest: '.',
          },
        ],
      }),
    ],
  },
});
