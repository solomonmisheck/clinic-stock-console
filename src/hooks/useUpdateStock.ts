import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStock } from '../lib/api/products';
import { queryKeys } from '../lib/api/queryKeys';
import { saveCorrection } from '../lib/stock/correctionsOverlay';
import type { Product } from '../types';

/**
 * Deliberately *not* optimistic. In a clinical stock tool, showing a new count before
 * it's confirmed risks a clerk trusting a number that then silently reverts on
 * failure -- worse than a brief spinner (see README decision log). Callers should
 * disable the count input and show a pending state for the duration of `isPending`.
 *
 * On success we patch the cache directly instead of invalidating it: DummyJSON's PUT
 * doesn't persist server-side, so a refetch here would overwrite the correction with
 * the original value. See correctionsOverlay.ts for the localStorage side of this.
 */
export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stock }: { id: number; stock: number }) => updateStock(id, stock),
    onSuccess: (_response, { id, stock }) => {
      saveCorrection(id, stock);
      queryClient.setQueryData<Product[]>(queryKeys.catalogue, (current) =>
        current?.map((product) => (product.id === id ? { ...product, stock } : product)),
      );
    },
  });
}
