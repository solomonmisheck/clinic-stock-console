import type { Product, ProductListResponse } from '../../types';
import { httpClient } from './client';

/**
 * Fields the list and detail views actually render. Trimmed deliberately: the
 * unfiltered payload for all 194 products is ~300KB, this is ~75KB. See the README
 * decision log for why we fetch the whole catalogue in one call instead of paging
 * through /products, /products/search and /products/category/{slug} separately.
 */
const SELECT_FIELDS = [
  'id',
  'title',
  'description',
  'category',
  'price',
  'stock',
  'rating',
  'brand',
  'thumbnail',
].join(',');

export interface CategoryOption {
  slug: string;
  name: string;
}

export async function fetchAllProducts(signal?: AbortSignal): Promise<Product[]> {
  const data = await httpClient.request<ProductListResponse>(
    `/products?limit=0&select=${SELECT_FIELDS}`,
    { auth: false, signal },
  );
  return data.products;
}

export async function fetchCategories(signal?: AbortSignal): Promise<CategoryOption[]> {
  return httpClient.request<CategoryOption[]>('/products/categories', { auth: false, signal });
}

export async function updateStock(id: number, stock: number): Promise<Product> {
  return httpClient.request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ stock }),
    auth: false,
  });
}
