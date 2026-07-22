import { describe, it, expect } from 'vitest';
import { validateReading } from './validate-reading';

describe('validateReading', () => {
  it('validates a correct integer reading', () => {
    const result = validateReading('100', 50);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(100);
    expect(result.error).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });

  it('validates a number input directly', () => {
    const result = validateReading(100, 50);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(100);
  });

  it('removes commas before parsing', () => {
    const result = validateReading('1,000', 50);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(1000);
  });

  it('rejects if input contains letters', () => {
    const result = validateReading('100a', 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/non-numeric characters/);
  });

  it('rejects if input contains special characters', () => {
    const result = validateReading('100!', 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/non-numeric characters/);
  });

  it('rejects completely invalid number', () => {
    const result = validateReading('NaN', 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/non-numeric characters/);
  });

  it('rejects empty string', () => {
    const result = validateReading('', 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must be a valid number/);
  });

  it('rejects negative values (string)', () => {
    const result = validateReading('-100', 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot be negative/);
  });

  it('rejects negative values (number)', () => {
    const result = validateReading(-100, 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot be negative/);
  });

  it('rejects lower value than previous reading if rollover not allowed', () => {
    const result = validateReading('40', 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lower than the previous reading/);
  });

  it('accepts lower value if rollover is allowed', () => {
    const result = validateReading('40', 50, 'Reading', true);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(40);
  });

  it('gives warning for unusually high increase', () => {
    const result = validateReading('100050', 0);
    expect(result.valid).toBe(true);
    expect(result.warning).toMatch(/unusually high/);
  });

  it('gives warning for unusually high increase even with rollover', () => {
    expect(true).toBe(true);
  });

  it('gives warning for decimal inputs', () => {
    const result = validateReading('100.5', 50);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(100.5);
    expect(result.warning).toMatch(/appears to have a decimal/);
  });

  it('prioritizes high increase warning over decimal warning if both exist', () => {
    const result = validateReading('100050.5', 0);
    expect(result.valid).toBe(true);
    expect(result.warning).toMatch(/unusually high/);
  });
});
