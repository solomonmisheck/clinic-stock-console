import { describe, expect, it } from 'vitest';
import { clampPage, parseStockListParams, serializeStockListParams } from '../listParams';

describe('parseStockListParams', () => {
  it('defaults to page 1, title/asc sort and no filters on an empty URL', () => {
    const params = parseStockListParams(new URLSearchParams(''));
    expect(params).toEqual({ q: '', category: null, sortBy: 'title', order: 'asc', page: 1 });
  });

  it('round-trips through serialize for a fully-specified state', () => {
    const original = {
      q: 'lemon',
      category: 'groceries',
      sortBy: 'price' as const,
      order: 'desc' as const,
      page: 3,
    };
    const serialized = serializeStockListParams(original);
    expect(parseStockListParams(serialized)).toEqual(original);
  });

  it('ignores an invalid sortBy rather than crashing on a hand-edited URL', () => {
    const params = parseStockListParams(new URLSearchParams('sortBy=nonsense'));
    expect(params.sortBy).toBe('title');
  });

  it('falls back to page 1 for a non-numeric or negative page value', () => {
    expect(parseStockListParams(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseStockListParams(new URLSearchParams('page=-5')).page).toBe(1);
    expect(parseStockListParams(new URLSearchParams('page=0')).page).toBe(1);
  });

  it('omits default values when serializing, keeping shared URLs short', () => {
    const serialized = serializeStockListParams({
      q: '',
      category: null,
      sortBy: 'title',
      order: 'asc',
      page: 1,
    });
    expect(serialized.toString()).toBe('');
  });
});

describe('clampPage', () => {
  it('keeps an in-range page unchanged', () => {
    expect(clampPage(2, 5)).toBe(2);
  });

  it('clamps a page above the total down to the last page -- the "shared a stale link" case', () => {
    expect(clampPage(12, 3)).toBe(3);
  });

  it('clamps a page below 1 up to 1', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
  });

  it('never returns a page below 1 even when there are no results at all', () => {
    expect(clampPage(4, 0)).toBe(1);
  });
});
