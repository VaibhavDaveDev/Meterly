import { createAuthClient } from "better-auth/client"
import { emailOTPClient } from "better-auth/client/plugins"

// In Astro, client-side code must use import.meta.env instead of process.env
// Vite will replace this at build time
const baseURL = import.meta.env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:4321';

export const authClient = createAuthClient({
    baseURL,
    plugins: [
        emailOTPClient()
    ]
})
