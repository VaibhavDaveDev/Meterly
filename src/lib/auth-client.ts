import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// In Astro, client-side code must use import.meta.env instead of process.env
const getClientBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return import.meta.env.PUBLIC_BETTER_AUTH_URL || "https://meterly.pages.dev";
};

export const authClient = createAuthClient({
  baseURL: getClientBaseURL(),
  plugins: [emailOTPClient()],
});
