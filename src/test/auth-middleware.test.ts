import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../api/middleware/auth";

// Mock getAuth
vi.mock("../api/lib/auth", () => ({
  getAuth: vi.fn(),
}));

import { getAuth } from "../api/lib/auth";

function makeApp() {
  const app = new Hono<{
    Bindings: Record<string, unknown>;
    Variables: Record<string, unknown>;
  }>();
  app.use("/protected", authMiddleware);
  app.get("/protected", (c) => c.json({ ok: true }));
  return app;
}

describe("authMiddleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session exists", async () => {
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      api: { getSession: vi.fn().mockResolvedValue(null) },
    });
    const app = makeApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when session user email is not verified", async () => {
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: "u1", emailVerified: false },
          session: { id: "s1" },
        }),
      },
    });
    const app = makeApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("continues to next handler when session is valid and email verified", async () => {
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: { id: "u1", emailVerified: true },
          session: { id: "s1" },
        }),
      },
    });
    const app = makeApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
