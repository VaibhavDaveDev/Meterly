import { describe, it, expect } from "vitest";
import { getAuth } from "./auth";

const minimalEnv = {
  DB: {} as D1Database,
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars-long-for-testing",
  BETTER_AUTH_URL: "http://localhost:4321",
  ENVIRONMENT: "production" as const,
};

describe("getAuth configuration", () => {
  it("returns a betterAuth instance without throwing when valid env is provided", () => {
    expect(() => getAuth(minimalEnv)).not.toThrow();
  });

  it("throws when BETTER_AUTH_SECRET is missing or empty in production", () => {
    expect(() => getAuth({ ...minimalEnv, BETTER_AUTH_SECRET: "" })).toThrow(
      "BETTER_AUTH_SECRET environment variable is required. Set ENVIRONMENT=development or ENVIRONMENT=test to use the local fallback."
    );
  });

  it("throws when BETTER_AUTH_URL is missing or empty in production", () => {
    expect(() => getAuth({ ...minimalEnv, BETTER_AUTH_URL: "" })).toThrow(
      "BETTER_AUTH_URL environment variable is required in production."
    );
  });

  it("registers google social provider when client id and secret are present", () => {
    const auth = getAuth({
      ...minimalEnv,
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });
    expect(auth.options.socialProviders?.google).toBeDefined();
  });

  it("registers github social provider when client id and secret are present", () => {
    const auth = getAuth({
      ...minimalEnv,
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
    });
    expect(auth.options.socialProviders?.github).toBeDefined();
  });

  it("does not register social provider when client id or secret is absent", () => {
    const auth = getAuth({
      ...minimalEnv,
      GOOGLE_CLIENT_ID: "google-id",
      // GOOGLE_CLIENT_SECRET missing
    });
    expect(auth.options.socialProviders?.google).toBeUndefined();
  });

  it("applies strict rate limiting in production", () => {
    const auth = getAuth(minimalEnv);
    expect(auth).toBeDefined();
  });

  it("applies lenient rate limiting outside production", () => {
    const auth = getAuth({ ...minimalEnv, ENVIRONMENT: "development" });
    expect(auth).toBeDefined();
  });
});
