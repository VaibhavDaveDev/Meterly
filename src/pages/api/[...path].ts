import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import app, { type Bindings } from '../../api/app';

export const ALL: APIRoute = async (context) => {
  // Astro v6: Use cloudflare:workers env import
  return app.fetch(context.request, env as unknown as Bindings, context.locals.cfContext);
};
