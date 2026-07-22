// Native PDF text extraction using pdfjs-dist.
// Returns structured field values using regex patterns on the raw text.
// Falls back gracefully if pdf.js is unavailable.
//
// IMPORTANT: pdfjs-dist must be lazy-imported so it doesn't inflate
// the initial JS bundle for users who never upload a bill.

export interface BillExtractResult {
  presentReadingImport: number | null;
  pastReadingImport: number | null;
  presentReadingExport: number | null;
  presentReadingSolarGen: number | null;
  totalAmountDue: number | null;
  billPeriod: string | null;
  extractionMethod: "native" | "ocr" | "none";
  rawText?: string; // for debugging
  error?: "PASSWORD_PROTECTED" | "CORRUPT_PDF" | "EMPTY_PDF";
}

// --- Regex patterns ---
// These are designed to match MGVCL-style bills and common Indian electricity bills.
const PATTERNS = {
  // Matches: "Present Reading    9920   0   0   0"
  // or:      "Present Reading: 9920"
  // Captures the FIRST number (Active/IMP column)
  presentImport: [
    /present\s*reading[\s:|]*([0-9,]+)/i,
    /current\s*reading[\s:|]*([0-9,]+)/i,
    /reading\s*\(imp\)[\s:]*([0-9,]+)/i,
  ],

  // Matches: "Past Reading    00009594   0   0   0"
  pastImport: [
    /past\s*reading[\s:|]*([0-9,]+)/i,
    /previous\s*reading[\s:|]*([0-9,]+)/i,
    /last\s*reading[\s:|]*([0-9,]+)/i,
  ],

  // Matches: "Present Reading    9920   0   0   0"
  // EXP column is the 4th number after "Present Reading"
  // Use a multi-capture regex to get col 4
  presentExport: [
    /present\s*reading[\s|]+([0-9,]+)[\s|]+([0-9,]+)[\s|]+([0-9,]+)[\s|]+([0-9,]+)/i,
    /reading\s*\(exp\)[\s:]*([0-9,]+)/i,
    /export\s*reading[\s:]*([0-9,]+)/i,
  ],

  // Solar generation (often labeled "Gen" or "Solar Gen")
  presentSolarGen: [
    /solar\s*gen(?:eration)?\s*reading[\s:]*([0-9,]+)/i,
    /generation\s*reading[\s:]*([0-9,]+)/i,
    /reading\s*\(gen\)[\s:]*([0-9,]+)/i,
  ],

  // Total amount due — look for the final amount
  totalDue: [
    /total\s*amount\s*due[\s:₹Rs.]*([0-9,]+\.?[0-9]*)/i,
    /grand\s*total[\s:₹Rs.]*([0-9,]+\.?[0-9]*)/i,
    /net\s*total[\s:₹Rs.]*([0-9,]+\.?[0-9]*)/i,
    /amount\s*due[\s:₹Rs.]*([0-9,]+\.?[0-9]*)/i,
    /(?:ભરવાપાત્ર\s*રકમ)[\s:Rs.]*([0-9,]+\.?[0-9]*)/i, // Gujarati text on MGVCL bills
  ],

  // Bill period: "AUG-SEP,24" or "August-September 2024"
  billPeriod: [
    /bill\s*period[\s:]*([A-Za-z]{3}-[A-Za-z]{3}[,\s]+\d{2,4})/i,
    /([A-Z]{3}-[A-Z]{3},\d{2})/,
    /for\s+(?:the\s+)?month\s+of[\s:]*([A-Za-z]+\s+\d{4})/i,
  ],
};

function tryPatterns(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      // For multi-capture patterns (export reading), return the last capture group
      const value = match[match.length - 1];
      return value.replace(/,/g, "").trim();
    }
  }
  return null;
}

function parseNumber(str: string | null): number | null {
  if (!str) return null;
  const n = parseFloat(str.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

export function extractFromText(
  rawText: string
): Omit<BillExtractResult, "extractionMethod" | "rawText" | "error"> {
  // Try to extract export reading using the multi-column pattern first
  let presentExport: number | null;
  const expMultiMatch =
    /present\s*reading[\s|]+([0-9,]+)[\s|]+([0-9,]+)[\s|]+([0-9,]+)[\s|]+([0-9,]+)/i.exec(
      rawText
    );
  if (expMultiMatch) {
    // Column order: Active, IMP, Reactive/Night, EXP
    // We want the 4th column (index 4 in match array)
    const expStr = expMultiMatch[4]?.replace(/,/g, "");
    presentExport = expStr ? parseFloat(expStr) : null;
    if (presentExport === 0) presentExport = null; // 0 export means no solar/export meter
  } else {
    presentExport = parseNumber(tryPatterns(rawText, PATTERNS.presentExport));
  }

  return {
    presentReadingImport: parseNumber(
      tryPatterns(rawText, PATTERNS.presentImport)
    ),
    pastReadingImport: parseNumber(tryPatterns(rawText, PATTERNS.pastImport)),
    presentReadingExport: presentExport,
    presentReadingSolarGen: parseNumber(
      tryPatterns(rawText, PATTERNS.presentSolarGen)
    ),
    totalAmountDue: parseNumber(tryPatterns(rawText, PATTERNS.totalDue)),
    billPeriod: tryPatterns(rawText, PATTERNS.billPeriod),
  };
}

export async function extractFromPdf(file: File): Promise<BillExtractResult> {
  // Lazy-import pdf.js so it doesn't inflate the main bundle
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source (required by pdf.js)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();

  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
  } catch (error: unknown) {
    const errorName =
      error && typeof error === "object" && "name" in error
        ? (error as { name: unknown }).name
        : null;
    if (errorName === "PasswordException") {
      return {
        presentReadingImport: null,
        pastReadingImport: null,
        presentReadingExport: null,
        presentReadingSolarGen: null,
        totalAmountDue: null,
        billPeriod: null,
        extractionMethod: "none",
        error: "PASSWORD_PROTECTED",
      };
    }
    if (errorName === "InvalidPDFException") {
      return {
        presentReadingImport: null,
        pastReadingImport: null,
        presentReadingExport: null,
        presentReadingSolarGen: null,
        totalAmountDue: null,
        billPeriod: null,
        extractionMethod: "none",
        error: "CORRUPT_PDF",
      };
    }
    if (errorName === "MissingPDFException") {
      return {
        presentReadingImport: null,
        pastReadingImport: null,
        presentReadingExport: null,
        presentReadingSolarGen: null,
        totalAmountDue: null,
        billPeriod: null,
        extractionMethod: "none",
        error: "EMPTY_PDF",
      };
    }
    // other errors
    return {
      presentReadingImport: null,
      pastReadingImport: null,
      presentReadingExport: null,
      presentReadingSolarGen: null,
      totalAmountDue: null,
      billPeriod: null,
      extractionMethod: "none",
    };
  }

  if (pdf.numPages === 0) {
    return {
      presentReadingImport: null,
      pastReadingImport: null,
      presentReadingExport: null,
      presentReadingSolarGen: null,
      totalAmountDue: null,
      billPeriod: null,
      extractionMethod: "none",
      error: "EMPTY_PDF",
    };
  }

  // Extract text from page 1 (bills are always single-page or the summary is page 1)
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();

  // Concatenate text items with spaces, preserving line breaks where Y changes significantly
  let rawText = "";
  let lastY = -1;
  for (const item of textContent.items) {
    if ("str" in item) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const y = Math.round((item as any).transform[5]);
      if (lastY !== -1 && Math.abs(y - lastY) > 5) {
        rawText += "\n";
      }
      rawText += item.str + " ";
      lastY = y;
    }
  }

  // Fallback to OCR if < 20 non-whitespace chars
  if (rawText.replace(/\s/g, "").length >= 20) {
    const extracted = extractFromText(rawText);

    // Check if we found anything useful
    const foundSomething =
      extracted.presentReadingImport !== null ||
      extracted.totalAmountDue !== null;

    if (foundSomething) {
      return { ...extracted, extractionMethod: "native", rawText };
    }
  }

  // --- OCR fallback ---
  // Render at 2x scale for high quality (approximately 144 DPI equivalent)
  // NO compression here — we want maximum Tesseract accuracy.
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return {
      presentReadingImport: null,
      pastReadingImport: null,
      presentReadingExport: null,
      presentReadingSolarGen: null,
      totalAmountDue: null,
      billPeriod: null,
      extractionMethod: "none",
      rawText,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport } as any).promise;

  // Run OCR
  const { runOcr } = await import("./ocr-worker");
  // Convert ImageData to Blob for Tesseract
  const ocrBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png")
  );
  if (!ocrBlob) {
    return {
      presentReadingImport: null,
      pastReadingImport: null,
      presentReadingExport: null,
      presentReadingSolarGen: null,
      totalAmountDue: null,
      billPeriod: null,
      extractionMethod: "none",
      rawText,
    };
  }

  const ocrResult = await runOcr(ocrBlob);
  const ocrExtracted = extractFromText(ocrResult.rawText);
  const ocrFoundSomething =
    ocrExtracted.presentReadingImport !== null ||
    ocrExtracted.totalAmountDue !== null;

  return {
    ...ocrExtracted,
    extractionMethod: ocrFoundSomething ? "ocr" : "none",
    rawText: ocrResult.rawText,
  };
}

// For a physical meter photo (JPG/PNG/WebP) — just run Tesseract, extract single number.
// readingType determines which form field to pre-fill.
export async function extractFromMeterPhoto(
  file: File,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _readingType: "import" | "export" | "solar_gen"
): Promise<{ value: number | null; confidence: number }> {
  const { runOcr } = await import("./ocr-worker");
  const result = await runOcr(file);

  // Extract single largest number (meter display is one big number)
  const numbers = result.rawText.match(/\d[\d. ]*\d|\d/g) || [];
  const parsed = numbers
    .map((n) => parseFloat(n.replace(/[, ]/g, "")))
    .filter((n) => !isNaN(n) && n >= 0)
    .sort((a, b) => b - a);

  return { value: parsed[0] ?? null, confidence: result.confidence };
}

// Render a specific page of a PDF to a PNG Blob (useful for generating a preview image)
export async function getPdfPageAsBlob(
  file: File,
  pageNumber: number = 1
): Promise<Blob | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (pdf.numPages === 0) return null;

    const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport } as any).promise;

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
  } catch (e) {
    console.error("Failed to render PDF page as blob", e);
    return null;
  }
}
