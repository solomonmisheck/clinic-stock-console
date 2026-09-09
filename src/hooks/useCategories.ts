import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../lib/api/products';
import { queryKeys } from '../lib/api/queryKeys';
import { isClinicCategory } from '../lib/stock/clinicCategories';

/** Scoped to the same four categories as useStockCatalogue -- see clinicCategories.ts. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async ({ signal }) => {
      const all = await fetchCategories(signal);
      return all.filter((category) => isClinicCategory(category.slug));
    },
    staleTime: 30 * 60 * 1000,
  });
}
