import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StockListParams } from '../types';
import { parseStockListParams, serializeStockListParams } from '../lib/stock/listParams';

export interface UpdateOptions {
  /** Reset to page 1 -- use for any change that can invalidate the current page's contents. */
  resetPage?: boolean;
}

/**
 * The URL is the single source of truth for search/filter/sort/page (see README
 * decision log): this hook is the only place that reads or writes it, so every screen
 * that needs list state agrees on the same shape. We always call setSearchParams with
 * `replace: true` -- these are refinements of one "view", not separate history
 * entries, so the browser back button takes you out of the stock list rather than
 * back through every keystroke and filter click.
 */
export function useStockListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseStockListParams(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<StockListParams>, options: UpdateOptions = {}) => {
      const next: StockListParams = { ...params, ...patch };
      if (options.resetPage && patch.page === undefined) {
        next.page = 1;
      }
      setSearchParams(serializeStockListParams(next), { replace: true });
    },
    [params, setSearchParams],
  );

  return { params, update };
}
