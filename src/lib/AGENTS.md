# Client Libraries DOX

## Purpose

- Client-side utilities, API wrappers, auth client, query keys, image compression, and OCR extractors.

## Ownership

- `auth-client.ts` owns the Better Auth client instance.
- `api-client.ts` owns the custom `apiClient` fetch wrapper, handling 401 redirect to `/login` and 403 redirect to `/verify-email`.
- `query-client.ts` owns the singleton `QueryClient` factory for TanStack Query.
- `query-keys.ts` owns centralized TanStack Query key factories.
- `format.ts` owns date and currency formatting utilities (`parseDateInput`, currency formatters).
- `image-compress.ts` owns browser Canvas-based image compression to WebP.
- `image-cache.ts` and `cache.ts` own IndexedDB caching for meter photos.
- `ocr-worker.ts`, `pdf-extract.ts`, `ocr-extraction.ts` own client-side bill and meter OCR / PDF text parsing.
- `utils.ts` owns generic frontend utility functions (such as `cn`).

## Local Contracts

- All query keys must be registered in `query-keys.ts`.
- `pdf-extract.ts` uses dynamic `import('pdfjs-dist')` to prevent bundle bloat; do not convert to static import.

## Work Guidance

- `extractFromText` is Node-safe (pure regex); `extractFromPdf` requires canvas / DOMMatrix polyfills in non-browser environments.

## Verification

```bash
pnpm test --run src/lib
```

## Child DOX Index

No child DOX files.
