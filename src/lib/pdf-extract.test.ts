import { describe, it, expect, vi } from 'vitest';
import { extractFromText, extractFromPdf } from './pdf-extract';

// --- Pure regex text extraction tests ---
describe('extractFromText', () => {
  it('extracts present import reading', () => {
    const text = 'Present Reading    9920   0   0   0';
    expect(extractFromText(text).presentReadingImport).toBe(9920);

    const text2 = 'Current Reading: 12,345';
    expect(extractFromText(text2).presentReadingImport).toBe(12345);

    const text3 = 'Reading (IMP) : 5678';
    expect(extractFromText(text3).presentReadingImport).toBe(5678);
  });

  it('extracts past import reading', () => {
    const text = 'Past Reading    00009594   0   0   0';
    expect(extractFromText(text).pastReadingImport).toBe(9594);

    const text2 = 'Previous Reading: 8,000';
    expect(extractFromText(text2).pastReadingImport).toBe(8000);
  });

  it('extracts present export reading from multi-column layout', () => {
    const text = 'Present Reading    9920   123   0   456';
    // Col 1: 9920, Col 2: 123, Col 3: 0, Col 4: 456 (Export)
    expect(extractFromText(text).presentReadingExport).toBe(456);
  });

  it('ignores present export reading if 0', () => {
    const text = 'Present Reading    9920   123   0   0';
    expect(extractFromText(text).presentReadingExport).toBeNull();
  });

  it('extracts present export reading from fallback patterns', () => {
    const text = 'Reading (EXP): 789';
    expect(extractFromText(text).presentReadingExport).toBe(789);
  });

  it('extracts solar generation reading', () => {
    const text = 'Solar Gen Reading: 500';
    expect(extractFromText(text).presentReadingSolarGen).toBe(500);

    const text2 = 'Generation Reading : 600';
    expect(extractFromText(text2).presentReadingSolarGen).toBe(600);
  });

  it('extracts total amount due', () => {
    const text = 'Total Amount Due: Rs. 1,234.50';
    expect(extractFromText(text).totalAmountDue).toBe(1234.50);

    const text2 = 'Grand Total ₹ 999';
    expect(extractFromText(text2).totalAmountDue).toBe(999);

    const text3 = 'Net Total 50.75';
    expect(extractFromText(text3).totalAmountDue).toBe(50.75);

    const text4 = 'ભરવાપાત્ર રકમ: 1000';
    expect(extractFromText(text4).totalAmountDue).toBe(1000);
  });

  it('extracts bill period', () => {
    const text = 'Bill Period: AUG-SEP,24';
    expect(extractFromText(text).billPeriod).toBe('AUG-SEP24');

    const text2 = 'For the month of August 2024';
    expect(extractFromText(text2).billPeriod).toBe('August 2024');
  });

  it('returns null for missing fields', () => {
    const text = 'Hello world this is a random text.';
    const result = extractFromText(text);
    expect(result.presentReadingImport).toBeNull();
    expect(result.pastReadingImport).toBeNull();
    expect(result.presentReadingExport).toBeNull();
    expect(result.presentReadingSolarGen).toBeNull();
    expect(result.totalAmountDue).toBeNull();
    expect(result.billPeriod).toBeNull();
  });
});

let mockPdfjsError: { name: string } | Error | null = null;
let mockPdfjsNumPages: number = 1;

vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () => ({
      promise: mockPdfjsError 
        ? Promise.reject(mockPdfjsError)
        : Promise.resolve({ numPages: mockPdfjsNumPages })
    })
  };
});

// --- Mocked pdf.js tests ---
describe('extractFromPdf', () => {
  beforeEach(() => {
    mockPdfjsError = null;
    mockPdfjsNumPages = 1;
  });

  it('handles mocked pdf.js PasswordException', async () => {
    mockPdfjsError = { name: 'PasswordException' };

    const file = new File([], 'test.pdf');
    const result = await extractFromPdf(file);
    
    expect(result.error).toBe('PASSWORD_PROTECTED');
    expect(result.extractionMethod).toBe('none');
  });

  it('handles mocked pdf.js InvalidPDFException', async () => {
    mockPdfjsError = { name: 'InvalidPDFException' };

    const file = new File([], 'test.pdf');
    const result = await extractFromPdf(file);
    
    expect(result.error).toBe('CORRUPT_PDF');
    expect(result.extractionMethod).toBe('none');
  });

  it('handles mocked pdf.js MissingPDFException', async () => {
    mockPdfjsError = { name: 'MissingPDFException' };

    const file = new File([], 'test.pdf');
    const result = await extractFromPdf(file);
    
    expect(result.error).toBe('EMPTY_PDF');
    expect(result.extractionMethod).toBe('none');
  });

  it('handles mocked pdf with 0 pages', async () => {
    mockPdfjsNumPages = 0;

    const file = new File([], 'test.pdf');
    const result = await extractFromPdf(file);
    
    expect(result.error).toBe('EMPTY_PDF');
    expect(result.extractionMethod).toBe('none');
  });
});
