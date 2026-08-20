import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { apiClient } from "./api-client";

const server = setupServer(
  http.get("/api/success", () =>
    HttpResponse.json({ success: true, data: { hello: "world" } })
  ),
  http.get("/api/error-body", () =>
    HttpResponse.json(
      { success: false, error: { code: "BAD", message: "Business error" } },
      { status: 200 }
    )
  ),
  http.get("/api/http-error", () =>
    HttpResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Missing" } },
      { status: 404 }
    )
  ),
  http.get("/api/http-error-no-body", () =>
    HttpResponse.json({}, { status: 500 })
  ),
  http.post("/api/items", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true, data: body });
  }),
  http.patch("/api/items/1", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true, data: body });
  }),
  http.delete("/api/items/1", () =>
    HttpResponse.json({ success: true, data: null })
  ),
  http.get("/api/network-fail", () => HttpResponse.error())
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("apiClient", () => {
  describe("get", () => {
    it("returns data on a successful response", async () => {
      const result = await apiClient.get<{ hello: string }>("/success");
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ hello: "world" });
    });

    it("returns the error message when success=false in a 200 response", async () => {
      const result = await apiClient.get("/error-body");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Business error");
    });

    it("returns the error message for a non-OK HTTP response", async () => {
      const result = await apiClient.get("/http-error");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Missing");
    });

    it("falls back to a generic message when a non-OK response has no error body", async () => {
      const result = await apiClient.get("/http-error-no-body");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("API Error: 500");
    });

    it("returns a network failure message when fetch throws", async () => {
      const result = await apiClient.get("/network-fail");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBeTruthy();
    });
  });

  describe("post", () => {
    it("sends a POST request with a JSON body and returns the response data", async () => {
      const result = await apiClient.post<{ name: string }>("/items", {
        name: "New Item",
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ name: "New Item" });
    });
  });

  describe("patch", () => {
    it("sends a PATCH request with a JSON body and returns the response data", async () => {
      const result = await apiClient.patch<{ name: string }>("/items/1", {
        name: "Updated Item",
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ name: "Updated Item" });
    });
  });

  describe("delete", () => {
    it("sends a DELETE request and returns success", async () => {
      const result = await apiClient.delete("/items/1");
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });
  });

  describe("apiFetch — 403 handling", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        location: { pathname: "/dashboard", search: "", href: "/dashboard" },
      });
      server.use(
        http.get("/api/forbidden-redirect", () =>
          HttpResponse.json(
            {
              success: false,
              error: { code: "FORBIDDEN", message: "Email not verified" },
            },
            { status: 403 }
          )
        ),
        http.get("/api/forbidden-no-redirect", () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: "OWNERSHIP_REQUIRED",
                message: "You do not own this resource",
              },
            },
            { status: 403 }
          )
        ),
        http.get("/api/forbidden-no-message", () =>
          HttpResponse.json(
            { success: false, error: { code: "OWNERSHIP_REQUIRED" } },
            { status: 403 }
          )
        )
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("redirects to /verify-email when 403 with FORBIDDEN code", async () => {
      const result = await apiClient.get("/forbidden-redirect");
      expect(window.location.href).toBe("/verify-email");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Email verification required");
    });

    it("does not redirect to /verify-email when already on /verify-email", async () => {
      vi.stubGlobal("window", {
        location: {
          pathname: "/verify-email",
          search: "",
          href: "/verify-email",
        },
      });
      const result = await apiClient.get("/forbidden-redirect");
      expect(window.location.href).toBe("/verify-email");
      expect(result.error?.message).toBe("Email verification required");
    });

    it("returns generic error message when 403 is not FORBIDDEN code", async () => {
      const result = await apiClient.get("/forbidden-no-redirect");
      expect(window.location.href).toBe("/dashboard");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("You do not own this resource");
    });

    it("returns fallback message when 403 body has no error message", async () => {
      const result = await apiClient.get("/forbidden-no-message");
      expect(result.error?.message).toBe("Forbidden");
    });
  });

  it("does not expose the removed archiveTenancy/unarchiveTenancy helpers", () => {
    expect(
      (apiClient as unknown as Record<string, unknown>).archiveTenancy
    ).toBeUndefined();
    expect(
      (apiClient as unknown as Record<string, unknown>).unarchiveTenancy
    ).toBeUndefined();
  });

  describe("defensive parsing", () => {
    it("handles non-JSON / HTML 403 response gracefully without throwing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 403,
          ok: false,
          json: () =>
            Promise.reject(new SyntaxError("Unexpected token < in JSON")),
        })
      );
      const result = await apiClient.get("/protected");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("Forbidden");
      vi.unstubAllGlobals();
    });

    it("handles non-JSON / HTML 500 response gracefully without throwing", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 500,
          ok: false,
          json: () =>
            Promise.reject(new SyntaxError("Unexpected token < in JSON")),
        })
      );
      const result = await apiClient.get("/error-endpoint");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("API Error: 500");
      vi.unstubAllGlobals();
    });

    it("handles 200 OK with unparseable JSON body gracefully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 200,
          ok: true,
          json: () => Promise.reject(new SyntaxError("Unexpected token")),
        })
      );
      const result = await apiClient.get("/corrupted-data");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("An unknown error occurred");
      vi.unstubAllGlobals();
    });
  });
});
