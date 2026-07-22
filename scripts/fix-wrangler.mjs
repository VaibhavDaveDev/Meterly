/**
 * Post-build fix for Cloudflare Pages deployment.
 *
 * Problem: Astro generates .wrangler/deploy/config.json which redirects
 * Cloudflare to use dist/server/wrangler.json as the deployment config.
 * That file is a Worker config (has "main"), which conflicts with our root
 * wrangler.jsonc that has "pages_build_output_dir". Pages rejects both keys.
 *
 * Fix: Delete the pointer file. Cloudflare falls back to reading the root
 * wrangler.jsonc (valid Pages config), and auto-detects dist/_worker.js.
 * The dist/server/ directory is left intact for the worker to import from.
 */

import { rmSync } from 'fs';

rmSync('.wrangler/deploy/config.json', { force: true });
console.log('✅  Removed .wrangler/deploy/config.json redirect pointer.');
