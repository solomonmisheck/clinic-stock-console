import { TextField } from '../../components/ui/TextField';

/** Fully controlled -- see useSearchDraft for the debounce/reconciliation logic. */
export function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      className="list-controls__search"
      label="Search stock"
      type="search"
      placeholder="Search by title, category or brand"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
