import { compressToWebP } from './image-compress';
import { extractFromPdf, extractFromMeterPhoto, BillExtractResult } from './pdf-extract';

export function validateFilePreFlight(file: File): string | null {
  if (file.size === 0) return 'The uploaded file is empty.';
  if (file.size < 10 * 1024) {
    return 'The file is very small (< 10KB). It may be corrupted or incomplete.';
  }
  
  const isPdf = file.type === 'application/pdf';
  
  if (isPdf) {
    if (file.size > 10 * 1024 * 1024) return 'PDF is too large. Maximum is 10 MB.';
  } else {
    if (!file.type.startsWith('image/')) return 'Only images and PDFs are supported.';
    if (file.type === 'image/gif' || file.type === 'image/tiff' || file.type === 'image/svg+xml' || file.type === 'image/bmp') {
      return 'This image format is not supported. Please use JPEG, PNG, WEBP, or HEIC.';
    }
    if (file.size > 20 * 1024 * 1024) return 'Image is too large. Maximum is 20 MB before compression.';
  }
  
  return null;
}

export async function processPdfFile(file: File): Promise<{
  success: boolean;
  message: string;
  result?: BillExtractResult;
}> {
  let pdfResult: BillExtractResult;
  try {
    pdfResult = await extractFromPdf(file);
  } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return { success: false, message: e.message || 'Failed to process PDF.' };
  }

  if (pdfResult.error === 'PASSWORD_PROTECTED') {
    return { success: false, message: 'This PDF is password-protected. Open it in a PDF viewer, remove the password, then upload again.' };
  }
  if (pdfResult.error === 'CORRUPT_PDF') {
    return { success: false, message: 'This file could not be read as a PDF. It may be corrupted or incomplete.' };
  }
  if (pdfResult.error === 'EMPTY_PDF') {
    return { success: false, message: 'The PDF appears to be empty.' };
  }

  return {
    success: true,
    message: pdfResult.extractionMethod !== 'none' ? 'PDF processed successfully' : 'Could not extract readings from PDF. Enter manually.',
    result: pdfResult
  };
}

export async function processImageFile(file: File): Promise<{
  success: boolean;
  message: string;
  compressed?: { blob: Blob; originalSizeKb: number; compressedSizeKb: number };
}> {
  try {
    const compressed = await compressToWebP(file, { maxWidthPx: 1200, quality: 0.75, maxSizeKb: 250 });
    return { success: true, message: 'Image compressed successfully', compressed };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    if (errorMsg.includes('too small')) {
      return { success: false, message: errorMsg };
    } else if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
      return { success: false, message: 'HEIC format is not supported by your browser. Please convert to JPEG.' };
    } else {
      return { success: false, message: 'Failed to compress image. Try a different file.' };
    }
  }
}

export async function runOcrOnImage(file: File): Promise<{ value: number | null; confidence: number }> {
  try {
    const { value, confidence } = await extractFromMeterPhoto(file, 'import');
    return { value, confidence };
  } catch {
    return { value: null, confidence: 0 };
  }
}
