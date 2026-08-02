import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "passthrough",
  }),
  integrations: [react(), tailwind()],
  vite: {
    optimizeDeps: {
      include: ["picomatch"],
    },
    ssr: {
      // Bundle all drizzle-orm sub-paths with Rollup instead of leaving them
      // for wrangler/esbuild. esbuild wraps drizzle-orm's internal circular ESM
      // imports in __init() which causes "Class extends value undefined" at runtime.
      noExternal: [/^drizzle-orm/],
    },
    build: {
      sourcemap: true,
      minify: false,
      rollupOptions: {
        output: {
          // Colocate ALL drizzle-orm code into a single chunk so its internal
          // circular imports stay within one file. Rollup handles
          // within-chunk circulars correctly via live bindings.
          // Without this, Rollup splits drizzle-orm across chunks creating
          // inter-chunk circulars that esbuild can't handle without __init.
          manualChunks(id) {
            if (id.includes("drizzle-orm")) {
              return "drizzle-bundle";
            }
          },
        },
      },
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
            dest: ".",
          },
        ],
      }),
    ],
  },
});
