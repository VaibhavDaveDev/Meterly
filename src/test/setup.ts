// ── PDF smoke test polyfills ────────────────────────────────────────────────
// pdfjs-dist 6.x requires DOMMatrix, Path2D, and HTMLCanvasElement at module
// evaluation time and during rendering. We install native bindings from @napi-rs/canvas.
import {
  createCanvas,
  DOMMatrix as NapiDOMMatrix,
  Path2D as NapiPath2D,
} from "@napi-rs/canvas";

// 1. Native geometry globals from @napi-rs/canvas
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error PDF.js geometry global
  globalThis.DOMMatrix = NapiDOMMatrix;
}

if (typeof globalThis.Path2D === "undefined") {
  // @ts-expect-error PDF.js path clipping global
  globalThis.Path2D = NapiPath2D;
}

// 2. Synchronized Canvas 2D context + toBlob adapter for jsdom
if (typeof document !== "undefined") {
  const _origCreateElement = document.createElement.bind(document);
  document.createElement = (tag: string, ...args: unknown[]) => {
    const el = _origCreateElement(tag, ...(args as []));
    if (tag === "canvas") {
      const nativeCanvas = createCanvas(300, 150);
      Object.defineProperty(el, "width", {
        get: () => nativeCanvas.width,
        set: (w: number) => {
          nativeCanvas.width = w;
        },
        configurable: true,
      });
      Object.defineProperty(el, "height", {
        get: () => nativeCanvas.height,
        set: (h: number) => {
          nativeCanvas.height = h;
        },
        configurable: true,
      });
      (el as unknown as Record<string, unknown>).getContext = (type: string) =>
        type === "2d"
          ? (nativeCanvas.getContext(
              "2d"
            ) as unknown as CanvasRenderingContext2D)
          : null;
      (el as unknown as Record<string, unknown>).toBlob = (
        callback: (blob: Blob | null) => void,
        type?: string,
        quality?: number
      ) => {
        nativeCanvas.toBlob(callback, type, quality);
      };
    }
    return el;
  };
}
// ────────────────────────────────────────────────────────────────────────────

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../db/schema";
import { vi } from "vitest";
import path from "path";
import "@testing-library/jest-dom";

// Create an in-memory database
const sqlite = new Database(":memory:");

// Cloudflare D1 does NOT enforce FK constraints (PRAGMA foreign_keys = OFF is the default).
// Disable FK enforcement here to match production behavior. Our application code manually
// manages cascade order, so FK enforcement at the DB engine level is not needed in tests.
sqlite.pragma("foreign_keys = OFF");

// Wrap it with Drizzle using the better-sqlite3 driver
export const testDb = drizzle(sqlite, { schema }) as unknown as ReturnType<
  typeof drizzle
> & { batch: (queries: unknown[]) => Promise<unknown[]> };
testDb.batch = async (queries: unknown[]) => {
  const results = [];
  for (const q of queries) {
    results.push(await (q as Promise<unknown>));
  }
  return results;
};

// Run migrations against the in-memory database
migrate(testDb, {
  migrationsFolder: path.resolve(__dirname, "../db/migrations"),
});

// Mock the getDb function from src/db/index so that API routes use the in-memory DB
vi.mock("../db/index", () => ({
  getDb: () => testDb,
}));
