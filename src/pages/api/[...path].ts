import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import app, { type Bindings } from "../../api/app";

export const ALL: APIRoute = async (context) => {
  // Astro 6+: cloudflare:workers is the correct runtime env source.
  // locals.runtime.env was removed in Astro 6 — do NOT use it.
  return app.fetch(
    context.request,
    env as unknown as Bindings,
    context.locals.cfContext
  );
};
