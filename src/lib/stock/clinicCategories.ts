/**
 * DummyJSON has no medical/pharmacy category (24 real categories: beauty, furniture,
 * smartphones, womens-dresses, motorcycle, and so on -- checked directly against
 * /products/categories, not guessed). Of those 24, these four are the ones that
 * plausibly represent stock a clinic's supplies team would actually manage day to
 * day, distinct from clinical/pharmaceutical stock the data simply doesn't contain:
 * ward hygiene and personal-care consumables (skin-care, beauty) and patient/staff
 * provisions (groceries, kitchen-accessories).
 *
 * This is a curated slice of *real* DummyJSON data, not invented content -- every
 * item name, description, price and stock count is exactly what the API returns for
 * that product. See the README decision log for the full reasoning, including the
 * explicit trade-off against the brief's instruction to use the catalogue
 * unfiltered: this scoping was a deliberate, directed choice to make the visible
 * inventory read as a clinic's, not a default we drifted into.
 */
export const CLINIC_CATEGORY_SLUGS = [
  'skin-care',
  'beauty',
  'groceries',
  'kitchen-accessories',
] as const;

export function isClinicCategory(slug: string): boolean {
  return (CLINIC_CATEGORY_SLUGS as readonly string[]).includes(slug);
}
