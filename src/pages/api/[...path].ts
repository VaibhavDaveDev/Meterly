import type { APIRoute } from "astro";
import app, { type Bindings } from "../../api/app";

export const ALL: APIRoute = async (context) => {
  // context.locals.runtime.env is the correct source for Cloudflare Pages env vars
  // and secrets set in the Dashboard. The cloudflare:workers global import is empty
  // for Pages projects — it does not carry Dashboard secrets.
  const runtime = (
    context.locals as unknown as {
      runtime: { env: Bindings; ctx: ExecutionContext };
    }
  ).runtime;
  return app.fetch(context.request, runtime.env, runtime.ctx);
};
