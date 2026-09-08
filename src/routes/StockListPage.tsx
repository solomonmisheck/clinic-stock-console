import { useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/AsyncState';
import { useCategories } from '../hooks/useCategories';
import { useSearchDraft } from '../hooks/useSearchDraft';
import { useStockCatalogue } from '../hooks/useStockCatalogue';
import { useStockListParams } from '../hooks/useStockListParams';
import { buildStockPage } from '../lib/stock/filterSortPaginate';
import { CategoryFilter } from './stock-list/CategoryFilter';
import { ListControls } from './stock-list/ListControls';
import { Pagination } from './stock-list/Pagination';
import { SearchBox } from './stock-list/SearchBox';
import { SortControls } from './stock-list/SortControls';
import { StockListItem } from './stock-list/StockListItem';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './stock-list/ListControls.css';

export function StockListPage() {
  useDocumentTitle('Stock');
  const { params, update } = useStockListParams();
  const catalogue = useStockCatalogue();
  const categories = useCategories();

  const [searchDraft, setSearchDraft] = useSearchDraft(params.q, (q) =>
    update({ q }, { resetPage: true }),
  );

  // Filter/sort/paginate against the live search draft, not the (debounced) URL value,
  // so results update on every keystroke -- see useSearchDraft.ts. Computed with hooks
  // still unconditional (before the loading/error early returns below), using an empty
  // catalogue as a harmless placeholder until data actually arrives.
  const products = catalogue.data ?? [];
  const effectiveParams = { ...params, q: searchDraft };
  const page = buildStockPage(products, effectiveParams);
  const committedPage = buildStockPage(products, params).page;

  // Self-heal an out-of-range page in the URL -- e.g. someone shared a link with
  // ?page=12 and a filter or sort change since means there are only 3 pages now.
  // Skipped while a search commit is still debouncing (searchDraft !== params.q):
  // that case resolves itself when the commit fires with resetPage. Also skipped
  // until the catalogue has actually loaded, so we don't "correct" the URL against
  // the empty placeholder above.
  useEffect(() => {
    if (!catalogue.data) return;
    if (searchDraft !== params.q) return;
    if (committedPage !== params.page) {
      update({ page: committedPage });
    }
  }, [catalogue.data, committedPage, params.page, params.q, searchDraft, update]);

  if (catalogue.isPending) {
    return <LoadingState label="Loading stock catalogue…" />;
  }

  if (catalogue.isError) {
    return (
      <ErrorState
        message={
          catalogue.error instanceof Error
            ? catalogue.error.message
            : 'Could not load the stock catalogue.'
        }
        onRetry={() => catalogue.refetch()}
      />
    );
  }

  const hasAnyFilter = Boolean(params.q || params.category);

  function clearFilters() {
    setSearchDraft('');
    update({ q: '', category: null, page: 1 });
  }

  return (
    <>
      <h1 className="page-heading">Stock</h1>

      <ListControls>
        <SearchBox value={searchDraft} onChange={setSearchDraft} />
        <CategoryFilter
          value={params.category}
          categories={categories.data ?? []}
          onChange={(category) => update({ category }, { resetPage: true })}
        />
        <SortControls
          sortBy={params.sortBy}
          order={params.order}
          onChange={(patch) => update(patch, { resetPage: true })}
        />
      </ListControls>

      <p className="list-summary" aria-live="polite">
        {page.total} {page.total === 1 ? 'item' : 'items'} match your filters.
      </p>

      {page.items.length === 0 ? (
        <EmptyState title="No stock items match your search.">
          {hasAnyFilter && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </EmptyState>
      ) : (
        <ul className="stock-list">
          {page.items.map((item) => (
            <StockListItem key={item.id} item={item} to={`/items/${item.id}`} />
          ))}
        </ul>
      )}

      <Pagination
        page={page.page}
        totalPages={page.totalPages}
        total={page.total}
        onChange={(nextPage) => update({ page: nextPage })}
      />
    </>
  );
}
