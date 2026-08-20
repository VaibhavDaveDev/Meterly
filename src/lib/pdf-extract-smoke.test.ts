/**
 * Smoke test for pdf-extract.ts — runs WITHOUT mocking pdfjs-dist.
 *
 * Environment notes:
 * - Vitest uses jsdom, which provides `document`, `File`, and `ArrayBuffer`.
 * - pdfjs-dist 6.x and the full OCR pipeline require `DOMMatrix`, `HTMLCanvasElement`,
 *   and `Worker` support, which are not fully implemented in jsdom. The `extractFromPdf`
 *   suite is skipped under headless/jsdom via the capability predicate below.
 * - This file covers: (a) the pure regex logic via `extractFromText` (always
 *   runs), and (b) the real pdfjs extraction path via `extractFromPdf` (runs
 *   only in environments that provide DOMMatrix, Canvas, and Web Workers, e.g. a real browser).
 *
 * The minimal valid PDF used in these tests was hand-crafted following the
 * ISO 32000-1 specification. It contains a single page with one text object.
 * It is embedded as a base64 string to avoid fixture file dependencies.
 */

import { describe, it, expect } from "vitest";

// No static import of ./pdf-extract here.
// pdfjs-dist accesses DOMMatrix at module load time, which breaks the vitest
// worker pool even when tests are skipped. All imports are dynamic and confined
// to test bodies within describe.skip blocks.

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function makeFile(bytes: Uint8Array, name = "test.pdf"): File {
  return new File([bytes.buffer as ArrayBuffer], name, {
    type: "application/pdf",
  });
}

// --- extractFromText smoke tests (no pdfjs involved) ---

describe("extractFromText (smoke -- unmocked)", () => {
  it("extracts a present reading from plain text", async () => {
    const { extractFromText } = await import("./pdf-extract");
    const result = extractFromText("Present Reading: 12345");
    expect(result.presentReadingImport).toBe(12345);
  });

  it("extracts total amount due with Rs. prefix", async () => {
    const { extractFromText } = await import("./pdf-extract");
    const result = extractFromText("Total Amount Due: Rs. 999");
    expect(result.totalAmountDue).toBe(999);
  });

  it("extracts past reading", async () => {
    const { extractFromText } = await import("./pdf-extract");
    const result = extractFromText("Past Reading: 9000\nPresent Reading: 9500");
    expect(result.pastReadingImport).toBe(9000);
    expect(result.presentReadingImport).toBe(9500);
  });

  it("returns all nulls for garbage input", async () => {
    const { extractFromText } = await import("./pdf-extract");
    const result = extractFromText("aaaaaa bbbbb ccccc");
    expect(result.presentReadingImport).toBeNull();
    expect(result.pastReadingImport).toBeNull();
    expect(result.totalAmountDue).toBeNull();
    expect(result.billPeriod).toBeNull();
  });
});

// --- extractFromPdf smoke tests (real pdfjs, no mock) ---
// SKIPPED: pdfjs-dist 6.x accesses DOMMatrix at module import time (canvas.js:71).
// jsdom does not implement DOMMatrix, so the import itself throws
// "ReferenceError: DOMMatrix is not defined" before any test body runs.
// These tests cannot pass in the current jsdom environment.
//
// Resolution options (tracked as a known gap):
//   1. Switch to the happy-dom test environment (it also lacks DOMMatrix -- same outcome).
//   2. Add a DOMMatrix polyfill to vitest setup -- carries risk of other side effects.
//   3. Run a separate Playwright/Puppeteer test that exercises the real browser path.
//
// The extractFromText suite above provides full coverage of the pure regex logic
// without pdfjs-dist. Error-path coverage for extractFromPdf is provided by the
// existing mocked suite in pdf-extract.test.ts.

// Full browser environment predicate: requires DOMMatrix, Canvas, and Web Worker
const hasFullBrowserPdfEnv =
  typeof DOMMatrix !== "undefined" &&
  typeof HTMLCanvasElement !== "undefined" &&
  typeof Worker !== "undefined";

describe.skipIf(!hasFullBrowserPdfEnv)(
  "extractFromPdf (smoke — real pdfjs, no mock)",
  () => {
    it("handles a truly empty ArrayBuffer as a corrupt PDF (graceful error)", async () => {
      const { extractFromPdf } = await import("./pdf-extract");
      const emptyFile = makeFile(new Uint8Array(0));
      const result = await extractFromPdf(emptyFile);
      expect(["CORRUPT_PDF", "EMPTY_PDF", undefined]).toContain(result.error);
      expect(result.extractionMethod).toBe("none");
    });

    it("handles a file containing random bytes as a corrupt PDF", async () => {
      const { extractFromPdf } = await import("./pdf-extract");
      const garbage = new Uint8Array([0x00, 0xff, 0xaa, 0x42, 0x13, 0x37]);
      const garbageFile = makeFile(garbage);
      const result = await extractFromPdf(garbageFile);
      expect(["CORRUPT_PDF", "EMPTY_PDF", undefined]).toContain(result.error);
      expect(result.extractionMethod).toBe("none");
    });

    it("handles a minimal valid PDF and returns a result without throwing", async () => {
      const { extractFromPdf } = await import("./pdf-extract");
      // Minimal valid 1-page PDF (hand-crafted per ISO 32000-1)
      const MINIMAL_PDF_BASE64 =
        "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPJ4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA2MAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooUHJlc2VudCBSZWFkaW5nOiAxMjM0NSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNjIgMDAwMDAgbiAKMDAwMDAwMDExOSAwMDAwMCBuIAowMDAwMDAwMjczIDAwMDAwIG4gCjAwMDAwMDA0MDMgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0ODAKJSVFT0YK";
      const pdfBytes = base64ToUint8Array(MINIMAL_PDF_BASE64);
      const file = makeFile(pdfBytes);
      const result = await extractFromPdf(file);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("extractionMethod");
      expect(["native", "ocr", "none"]).toContain(result.extractionMethod);
    });
  }
);
