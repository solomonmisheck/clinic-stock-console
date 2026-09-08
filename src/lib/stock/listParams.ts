import type { SortField, SortOrder, StockListParams } from '../../types';

/**
 * Pure parse/serialize/clamp helpers for the stock list's URL state (search, category,
 * sort, page). Kept framework-free and dependency-free on purpose: this is exactly the
 * kind of "reload must restore the page" / "filter change must not strand the user on
 * an empty page" logic the brief calls out as easy to get wrong, so it's isolated here
 * to be unit tested without mounting React Router.
 */

export const PAGE_SIZE = 20;
export const DEFAULT_SORT_FIELD: SortField = 'title';
export const DEFAULT_SORT_ORDER: SortOrder = 'asc';
const SORT_FIELDS: SortField[] = ['title', 'price', 'stock', 'category'];

export function parseStockListParams(searchParams: URLSearchParams): StockListParams {
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawSortBy = searchParams.get('sortBy');
  const sortBy = (SORT_FIELDS as string[]).includes(rawSortBy ?? '')
    ? (rawSortBy as SortField)
    : DEFAULT_SORT_FIELD;

  const order: SortOrder = searchParams.get('order') === 'desc' ? 'desc' : DEFAULT_SORT_ORDER;

  return {
    q: searchParams.get('q') ?? '',
    category: searchParams.get('category'),
    sortBy,
    order,
    page,
  };
}

/** Omits params at their default value so the URL stays clean (e.g. `/stock` not `/stock?sortBy=title&order=asc&page=1`). */
export function serializeStockListParams(params: StockListParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.category) searchParams.set('category', params.category);
  if (params.sortBy !== DEFAULT_SORT_FIELD) searchParams.set('sortBy', params.sortBy);
  if (params.order !== DEFAULT_SORT_ORDER) searchParams.set('order', params.order);
  if (params.page !== 1) searchParams.set('page', String(params.page));
  return searchParams;
}

/** Keeps a page number inside [1, totalPages] instead of rendering an empty page. */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}
