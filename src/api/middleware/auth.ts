import { Context, Next } from "hono";
import { getAuth } from "../lib/auth";
import type { Bindings, Variables } from "../app";
import * as schema from "../../db/schema";

export const authMiddleware = async (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Unauthorized" },
      },
      401
    );
  }

  if (!session.user.emailVerified) {
    return c.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Email address must be verified to access this resource.",
        },
      },
      403
    );
  }

  c.set("user", session.user as typeof schema.user.$inferSelect);
  c.set("session", session.session as typeof schema.session.$inferSelect);
  await next();
};
