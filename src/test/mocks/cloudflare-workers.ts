// Stub for Cloudflare Workers runtime module.
// Used by Vitest so that imports of 'cloudflare:workers' don't crash Node.
// The actual env bindings are injected by Wrangler at runtime.
export const env = {} as Record<string, unknown>;
