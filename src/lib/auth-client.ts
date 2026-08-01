import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// In Astro, client-side code must use import.meta.env instead of process.env
const getClientBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const envUrl = import.meta.env.PUBLIC_BETTER_AUTH_URL;
  if (envUrl) {
    return envUrl;
  }
  if (import.meta.env.DEV) {
    return "http://localhost:4321";
  }
  throw new Error("PUBLIC_BETTER_AUTH_URL environment variable is required.");
};

export const authClient = createAuthClient({
  baseURL: getClientBaseURL(),
  plugins: [emailOTPClient()],
});
