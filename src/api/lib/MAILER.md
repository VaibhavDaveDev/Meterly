# Email Provider Integration

Meterly uses a provider-agnostic email abstraction in `email.ts`.
The active provider is selected via the `EMAIL_PROVIDER` environment variable.

## Providers

### Resend (primary — recommended)
- Set `EMAIL_PROVIDER=resend`
- Requires `RESEND_API_KEY` (from https://resend.com/api-keys)
- Requires `RESEND_FROM` — the verified sender, e.g. `Meterly <noreply@yourdomain.com>`
- **Domain must be verified** at https://resend.com/domains for production use
- Dev mode: when `ENVIRONMENT !== 'production'`, emails are redirected to `delivered@resend.dev`
  (Resend's official test address). OTP is also printed to terminal.

### [Atlas Mailer](https://github.com/VaibhavDaveDev/atlas-mailer.git) (fallback — no custom domain required)
- Set `EMAIL_PROVIDER=atlas`
- Requires `ATLAS_MAILER_URL` and `ATLAS_MAILER_SECRET`
- Atlas Mailer is a standalone Cloudflare Worker that relays via Gmail SMTP
- **Daily Limit:** 500 emails per day (tracked via Cloudflare KV in the Atlas Worker)
- Use when no custom sending domain is available

## API Contract ([Atlas Mailer](https://github.com/VaibhavDaveDev/atlas-mailer.git))
`POST /send`

### Headers
```
Authorization: Bearer <ATLAS_MAILER_SECRET>
Content-Type: application/json
```

### Request Body
```json
{
  "to": "recipient@example.com",
  "subject": "Subject line",
  "text": "Plain text (optional if html provided)",
  "html": "<p>HTML content</p> (optional if text provided)"
}
```

### Success Response (202 Accepted — email queued)
```json
{ "success": true, "id": "<uuid>", "status": "queued" }
```

### Error Responses
- `400` — Validation failure
- `401` — Invalid API key
- `429` — Daily limit exceeded (500 emails/day)
- `500` — SMTP transport failure

Meterly uses fire-and-forget delivery. It does not poll `/status/:id`.

## No Provider (development only)
If `EMAIL_PROVIDER` is not set and `ENVIRONMENT !== 'production'`, email sending is skipped.
The OTP is printed to the terminal. This is intentional for local dev without credentials.
