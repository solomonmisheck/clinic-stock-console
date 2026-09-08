import { Button } from '../../components/ui/Button';

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Stock list pages">
      <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="pagination__status" aria-live="polite">
        Page {page} of {totalPages} · {total} items
      </span>
      <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next
      </Button>
    </nav>
  );
}
