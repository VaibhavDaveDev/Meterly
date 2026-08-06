import { defineConfig } from "vitest/config";
import react from "@astrojs/react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve(
        import.meta.dirname,
        "src/test/mocks/cloudflare-workers.ts"
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    server: {
      deps: {
        inline: [/@microlabs\/otel-cf-workers/],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/api/**/*.ts", "src/db/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**", "src/**/*.d.ts"],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30,
      },
    },
  },
});
