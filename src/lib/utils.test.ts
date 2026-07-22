import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn util', () => {
  it('merges class names correctly', () => {
    expect(cn('p-4', 'm-2')).toBe('p-4 m-2');
  });

  it('handles conditional classes', () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn('p-4', isTrue && 'text-red-500', isFalse && 'bg-blue-500')).toBe('p-4 text-red-500');
  });

  it('resolves tailwind conflicts correctly using tailwind-merge', () => {
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });
});
