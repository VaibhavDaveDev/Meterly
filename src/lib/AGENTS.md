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
- `pdf-extract.ts`: PDF text extraction via pdfjs-dist with OCR fallback. Exports `extractFromPdf` (browser-only, requires canvas + Web Worker), `extractFromText` (pure regex, Node-safe), and `getPdfPageAsBlob`.
- `ocr-extraction.ts`: Higher-level orchestrator for processing bill uploads (PDF + image paths).

# Work Guidance

- Use `apiClient` for all data fetching to ensure consistent error handling and response parsing.
- Extend `apiClient` with specific, type-safe wrappers as API surface grows.
- `pdf-extract.ts` uses a lazy `import('pdfjs-dist')` to avoid bloating the main bundle. Do not convert this to a static import.
- `extractFromText` is Node-safe (pure regex) and fully covered by `pdf-extract.test.ts` and `pdf-extract-smoke.test.ts`. `extractFromPdf` requires a browser canvas and Web Worker; its smoke tests are skipped in jsdom due to `DOMMatrix` not being available — documented in `pdf-extract-smoke.test.ts`.

# Child DOX Index

(None)
