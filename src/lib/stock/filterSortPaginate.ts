import type { Product, StockListParams } from '../../types';
import { clampPage, PAGE_SIZE } from './listParams';

/** Case-insensitive match against the fields a supplies clerk would actually search by. */
export function filterProducts(products: Product[], params: StockListParams): Product[] {
  let result = products;

  if (params.category) {
    result = result.filter((product) => product.category === params.category);
  }

  const query = params.q.trim().toLowerCase();
  if (query) {
    result = result.filter(
      (product) =>
        product.title.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        (product.brand ?? '').toLowerCase().includes(query),
    );
  }

  return result;
}

export function sortProducts(products: Product[], params: StockListParams): Product[] {
  const direction = params.order === 'asc' ? 1 : -1;
  return [...products].sort((a, b) => {
    const a_ = a[params.sortBy];
    const b_ = b[params.sortBy];
    if (typeof a_ === 'string' && typeof b_ === 'string') {
      return a_.localeCompare(b_) * direction;
    }
    return ((a_ as number) - (b_ as number)) * direction;
  });
}

export interface StockPage {
  items: Product[];
  total: number;
  totalPages: number;
  /** May differ from the requested page if it was out of range for the current result set. */
  page: number;
}

/**
 * Filters, sorts and paginates in one pass, clamping the page so a category/sort
 * change (or a narrower search) never strands the user on a page with nothing on it
 * (requirement 2 in the brief).
 */
export function buildStockPage(products: Product[], params: StockListParams): StockPage {
  const filtered = filterProducts(products, params);
  const sorted = sortProducts(filtered, params);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = clampPage(params.page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: sorted.slice(start, start + PAGE_SIZE),
    total: sorted.length,
    totalPages,
    page,
  };
}
