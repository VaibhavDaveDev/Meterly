import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import app, { type Bindings } from "../../api/app";

export const ALL: APIRoute = async (context) => {
  const runtime = (
    context.locals as unknown as {
      runtime?: { env?: Bindings; ctx?: ExecutionContext };
    }
  )?.runtime;

  const combinedEnv = {
    ...(env as unknown as Bindings),
    ...(runtime?.env || {}),
  };

  const ctx = runtime?.ctx || {
    waitUntil: (p: Promise<unknown>) => p.catch(console.error),
  };

  return app.fetch(
    context.request,
    combinedEnv as unknown as Bindings,
    ctx as ExecutionContext
  );
};
