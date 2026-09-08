import { useEffect, useState } from 'react';

/**
 * Debounces a *derived* value, not the source of truth. The search input keeps its
 * own local state so typing feels instant and filtering (cheap, in-memory, see
 * filterSortPaginate.ts) runs against every keystroke; only writing the settled value
 * into the URL is delayed, so rapid typing doesn't spam history.replaceState.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
