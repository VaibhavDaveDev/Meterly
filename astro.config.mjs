import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "passthrough",
  }),
  integrations: [react()],
  vite: {
    optimizeDeps: {
      include: ["picomatch"],
    },
    ssr: {
      // Bundle all drizzle-orm sub-paths with Rollup, not wrangler/esbuild.
      // esbuild wraps drizzle-orm's internal circular ESM deps in __init()
      // lazy initializers, which causes "Class extends value undefined" at
      // runtime (SQLiteColumn extends Column fails because Column is undefined).
      noExternal: [/^drizzle-orm/],
    },
    build: {
      rollupOptions: {
        output: {
          // Colocate ALL drizzle-orm code into one chunk so its internal
          // circular imports stay within one file. Rollup handles within-chunk
          // circulars correctly via live bindings — no __init() needed.
          // Without this, Rollup splits drizzle-orm across chunks creating
          // inter-chunk circulars that esbuild wraps in __init().
          manualChunks(id) {
            if (id.includes("drizzle-orm")) {
              return "drizzle-bundle";
            }
          },
        },
      },
    },
    plugins: [
      tailwindcss(),
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
