# Purpose
Provides client-side utilities for interacting with Better Auth and the custom Meterly API.

# Ownership
Frontend and Fullstack developers.

# Local Contracts
- `auth-client.ts`: Better Auth client instance.
- `api-client.ts`: Generic wrapper for Meterly API calls.
- `utils.ts`: General-purpose frontend utility functions.
- `image-compress.ts`: Browser Canvas-based image compression to WebP.
- `image-cache.ts`: IndexedDB cache for meter bill photos.
- `ocr-worker.ts`: Web Worker for running Tesseract.js OCR without blocking the main thread.
- `dashboard-cache.ts`: IndexedDB caching for dashboard data.

# Work Guidance
- Use `apiClient` for all data fetching to ensure consistent error handling and response parsing.
- Extend `apiClient` with specific, type-safe wrappers as API surface grows.

# Child DOX Index
(None)
