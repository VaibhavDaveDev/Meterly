import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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

  it("does not expose the removed archiveTenancy/unarchiveTenancy helpers", () => {
    expect(
      (apiClient as unknown as Record<string, unknown>).archiveTenancy
    ).toBeUndefined();
    expect(
      (apiClient as unknown as Record<string, unknown>).unarchiveTenancy
    ).toBeUndefined();
  });
});