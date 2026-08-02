import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import app, { type Bindings } from "../../api/app";

export const ALL: APIRoute = async (context) => {
  // Astro v7 / @astrojs/cloudflare v14 APIs:
  //   - env bindings:       import { env } from "cloudflare:workers"  (runtime.env removed)
  //   - execution context:  context.locals.cfContext                   (runtime.ctx removed)
  const ctx = ((context.locals as { cfContext?: ExecutionContext })
    .cfContext ?? {
    waitUntil: (p: Promise<unknown>) => p.catch(console.error),
    passThroughOnException: () => {},
  }) as ExecutionContext;

  return app.fetch(context.request, env as unknown as Bindings, ctx);
};
