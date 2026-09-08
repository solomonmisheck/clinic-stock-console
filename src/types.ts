/**
 * Shared domain types. DummyJSON calls these "products"; the brief asks us to treat
 * the catalogue as clinic stock, so the UI-facing naming (StockItem) is deliberately
 * different from the wire format (Product) even though the shape is identical today.
 * That indirection is what lets us rename/reshape the domain later without touching
 * every API call site.
 */

export interface Product {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  brand?: string;
  thumbnail: string;
  images: string[];
}

export type StockItem = Product;

export interface ProductListResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
}

export interface LoginResponse extends AuthUser {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export type SortField = 'title' | 'price' | 'stock' | 'category';
export type SortOrder = 'asc' | 'desc';

export interface StockListParams {
  q: string;
  category: string | null;
  sortBy: SortField;
  order: SortOrder;
  page: number;
}
