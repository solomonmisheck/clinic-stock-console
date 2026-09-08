import { Select } from '../../components/ui/Select';
import type { CategoryOption } from '../../lib/api/products';

export function CategoryFilter({
  value,
  categories,
  onChange,
}: {
  value: string | null;
  categories: CategoryOption[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select
      label="Category"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">All categories</option>
      {categories.map((category) => (
        <option key={category.slug} value={category.slug}>
          {category.name}
        </option>
      ))}
    </Select>
  );
}
