/**
 * Patches dist/server/wrangler.json after Astro builds for Cloudflare Pages.
 *
 * Problems in the auto-generated file:
 *   1. `ASSETS` binding — reserved name in Pages projects.
 *   2. `SESSION` KV namespace entry has no `id` field — managed via the
 *      Cloudflare Dashboard, so we remove the placeholder entry.
 *
 * Everything else (especially the `main` / `_worker.js` entrypoint) is kept
 * intact so Cloudflare Pages still recognises this as an SSR Worker deployment.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve('dist/server/wrangler.json');

let raw;
try {
  raw = readFileSync(filePath, 'utf-8');
} catch {
  console.log('dist/server/wrangler.json not found — skipping patch.');
  process.exit(0);
}

const cfg = JSON.parse(raw);

// 1. Remove the top-level `assets` key (reserved ASSETS binding in Pages).
if (cfg.assets !== undefined) delete cfg.assets;

// Also filter from any binding arrays just in case.
['kv_namespaces', 'durable_objects', 'services', 'r2_buckets', 'd1_databases'].forEach(key => {
  if (Array.isArray(cfg[key])) {
    cfg[key] = cfg[key].filter(b => b.binding !== 'ASSETS');
  }
});

// 2. Remove SESSION KV entry that has no `id` (invalid for Pages config).
//    The real SESSION binding is managed in the Cloudflare Dashboard.
if (Array.isArray(cfg.kv_namespaces)) {
  cfg.kv_namespaces = cfg.kv_namespaces.filter(kv => {
    return !(kv.binding === 'SESSION' && !kv.id);
  });
  if (cfg.kv_namespaces.length === 0) delete cfg.kv_namespaces;
}

// 3. Remove unknown top-level fields that cause warnings.
const unknownTopLevel = [
  'definedEnvironments', 'ai_search_namespaces', 'ai_search', 'agent_memory',
  'secrets_store_secrets', 'artifacts', 'unsafe_hello_world', 'flagship',
  'worker_loaders', 'ratelimits', 'vpc_services', 'vpc_networks',
  'python_modules', 'previews',
];
unknownTopLevel.forEach(k => { if (k in cfg) delete cfg[k]; });

// 4. Remove unknown `dev` sub-fields.
if (cfg.dev && typeof cfg.dev === 'object') {
  delete cfg.dev.enable_containers;
  delete cfg.dev.generate_types;
}

writeFileSync(filePath, JSON.stringify(cfg, null, 2));
console.log('✅  dist/server/wrangler.json patched successfully.');
