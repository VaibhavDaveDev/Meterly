import { describe, it, expect } from 'vitest';
import { validateFilePreFlight } from './ocr-extraction';

describe('validateFilePreFlight', () => {
  it('rejects empty file', () => {
    const file = new File([], 'test.jpg', { type: 'image/jpeg' });
    expect(validateFilePreFlight(file)).toMatch(/empty/);
  });

  it('accepts valid PDF', () => {
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 12 * 1024 });
    expect(validateFilePreFlight(file)).toBeNull();
  });

  it('rejects large PDF', () => {
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
    expect(validateFilePreFlight(file)).toMatch(/too large/);
  });

  it('accepts valid image', () => {
    const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 12 * 1024 });
    expect(validateFilePreFlight(file)).toBeNull();
  });

  it('rejects unsupported image types', () => {
    const file = new File(['dummy'], 'test.gif', { type: 'image/gif' });
    Object.defineProperty(file, 'size', { value: 12 * 1024 });
    expect(validateFilePreFlight(file)).toMatch(/not supported/);
  });

  it('rejects large image', () => {
    const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });
    expect(validateFilePreFlight(file)).toMatch(/too large/);
  });
});
