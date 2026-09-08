import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../lib/api/products';
import { queryKeys } from '../lib/api/queryKeys';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 30 * 60 * 1000,
  });
}
