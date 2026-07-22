/**
 * Post-build fix for Cloudflare Pages deployment.
 *
 * @astrojs/cloudflare v13 generates:
 *   dist/client/  → static assets
 *   dist/server/  → SSR worker (entry.mjs + chunks)
 *   .wrangler/deploy/config.json → redirects Wrangler to dist/server/wrangler.json
 *
 * Cloudflare Pages CI needs _worker.js at the root of pages_build_output_dir.
 *
 * Fix:
 *   1. Copy dist/server/ into dist/client/server/ so all worker deps are available
 *   2. Create dist/client/_worker.js that re-exports the server entry
 *   3. Delete .wrangler/deploy/config.json so Pages reads root wrangler.jsonc
 *      (which has pages_build_output_dir: dist/client)
 */

import { rmSync, cpSync, writeFileSync } from 'fs';

// 1. Copy entire dist/server/ into dist/client/server/
cpSync('dist/server', 'dist/client/server', { recursive: true });
console.log('✅ Copied dist/server → dist/client/server');

// 2. Create the _worker.js entry point that Pages will detect
writeFileSync(
  'dist/client/_worker.js',
  `// Cloudflare Pages SSR worker entry\nexport { default } from './server/entry.mjs';\n`
);
console.log('✅ Created dist/client/_worker.js');

// 3. Remove the redirect pointer so Cloudflare reads root wrangler.jsonc
rmSync('.wrangler/deploy/config.json', { force: true });
console.log('✅ Removed .wrangler/deploy/config.json redirect pointer.');
