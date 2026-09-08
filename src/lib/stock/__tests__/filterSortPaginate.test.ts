import { describe, expect, it } from 'vitest';
import type { Product, StockListParams } from '../../../types';
import { buildStockPage } from '../filterSortPaginate';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 1,
    title: 'Item',
    description: '',
    category: 'beauty',
    price: 10,
    stock: 5,
    rating: 4,
    thumbnail: '',
    images: [],
    ...overrides,
  };
}

const baseParams: StockListParams = {
  q: '',
  category: null,
  sortBy: 'title',
  order: 'asc',
  page: 1,
};

describe('buildStockPage', () => {
  const products = [
    makeProduct({ id: 1, title: 'Bandage roll', category: 'first-aid', price: 3, stock: 40 }),
    makeProduct({ id: 2, title: 'Paracetamol', category: 'medicine', price: 5, stock: 12 }),
    makeProduct({ id: 3, title: 'Antiseptic wipes', category: 'first-aid', price: 4, stock: 0 }),
  ];

  it('filters by category', () => {
    const page = buildStockPage(products, { ...baseParams, category: 'first-aid' });
    expect(page.items.map((item) => item.id)).toEqual([3, 1]); // sorted by title asc
    expect(page.total).toBe(2);
  });

  it('filters by a case-insensitive search term matching title, category or brand', () => {
    const page = buildStockPage(products, { ...baseParams, q: 'PARA' });
    expect(page.items.map((item) => item.id)).toEqual([2]);
  });

  it('sorts numerically for numeric fields, not lexicographically', () => {
    const page = buildStockPage(products, { ...baseParams, sortBy: 'stock', order: 'desc' });
    expect(page.items.map((item) => item.stock)).toEqual([40, 12, 0]);
  });

  it('resets to page 1 when a filter narrows the result set below the requested page (requirement: never strand the user on an empty page)', () => {
    const page = buildStockPage(products, { ...baseParams, category: 'first-aid', page: 9 });
    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(2);
  });

  it('reports a single page of 1 when there are no results, rather than 0 pages', () => {
    const page = buildStockPage(products, { ...baseParams, q: 'nonexistent-item' });
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
    expect(page.totalPages).toBe(1);
    expect(page.page).toBe(1);
  });
});
