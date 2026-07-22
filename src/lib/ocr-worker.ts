// Tesseract.js Web Worker wrapper.
// Lazy-loads Tesseract (2MB WASM) only when called.
// Returns recognized text and extracted numeric reading.

import type { Worker as TesseractWorker } from 'tesseract.js';

let worker: TesseractWorker | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (worker) return worker;
  const Tesseract = await import('tesseract.js');
  worker = await Tesseract.createWorker('eng', 1, {
    // Logger suppressed in production
    logger: process.env.NODE_ENV === 'development' ? (m: unknown) => console.log(m) : undefined,
  });
  return worker;
}

export interface OcrResult {
  rawText: string;
  extractedNumber: number | null;
  confidence: number; // 0-100
}

export async function runOcr(imageBlob: Blob): Promise<OcrResult> {
  const w = await getWorker();
  const url = URL.createObjectURL(imageBlob);
  
  try {
    const { data } = await w.recognize(url);
    
    // Extract the largest number from the OCR text — likely the meter reading
    const numbers = data.text.match(/\d[\d,. ]*\d|\d/g) || [];
    const parsed = numbers
      .map(n => parseFloat(n.replace(/[, ]/g, '')))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => b - a); // largest first (meter readings are usually the biggest number)
    
    return {
      rawText: data.text,
      extractedNumber: parsed[0] ?? null,
      confidence: data.confidence,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

