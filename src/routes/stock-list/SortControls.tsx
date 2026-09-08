import { Select } from '../../components/ui/Select';
import type { SortField, SortOrder } from '../../types';

const SORT_FIELD_LABELS: Record<SortField, string> = {
  title: 'Title',
  price: 'Price',
  stock: 'Stock count',
  category: 'Category',
};

export function SortControls({
  sortBy,
  order,
  onChange,
}: {
  sortBy: SortField;
  order: SortOrder;
  onChange: (patch: { sortBy?: SortField; order?: SortOrder }) => void;
}) {
  return (
    <>
      <Select
        label="Sort by"
        value={sortBy}
        onChange={(event) => onChange({ sortBy: event.target.value as SortField })}
      >
        {Object.entries(SORT_FIELD_LABELS).map(([field, label]) => (
          <option key={field} value={field}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        label="Order"
        value={order}
        onChange={(event) => onChange({ order: event.target.value as SortOrder })}
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </Select>
    </>
  );
}
