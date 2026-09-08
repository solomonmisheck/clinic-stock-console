import { useQuery } from '@tanstack/react-query';
import { fetchAllProducts } from '../lib/api/products';
import { queryKeys } from '../lib/api/queryKeys';
import { applyCorrections } from '../lib/stock/correctionsOverlay';
import type { Product } from '../types';

/**
 * One query for the whole catalogue, shared by the list and detail views (see README
 * decision log for why we fetch everything once instead of driving the list through
 * /products/search and /products/category/{slug} separately). staleTime is generous:
 * this is one clinic's slow-moving stock catalogue, not a live feed, so we'd rather
 * avoid a refetch flickering a just-saved correction than chase perfect freshness.
 */
export function useStockCatalogue() {
  return useQuery<Product[]>({
    queryKey: queryKeys.catalogue,
    queryFn: async ({ signal }) => applyCorrections(await fetchAllProducts(signal)),
    staleTime: 5 * 60 * 1000,
  });
}
