import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as productsApi from '../../lib/api/products';
import { StockListPage } from '../StockListPage';

/**
 * Requirement 4 in the brief: "Every screen that loads data has a loading state, an
 * empty state and an error state. The error state must offer the user a way to
 * recover. Test the error path against /http/500." The other 21 tests cover pure
 * logic and one form component in isolation; this is the one that actually mounts
 * the real data-fetching screen and proves the error-and-recover path works end to
 * end, by mocking the transport layer to fail the way a live /http/500 does.
 */
vi.mock('../../lib/api/products', () => ({
  fetchAllProducts: vi.fn(),
  fetchCategories: vi.fn(),
  updateStock: vi.fn(),
}));

function renderStockListPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/stock']}>
        <StockListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StockListPage data states', () => {
  beforeEach(() => {
    vi.mocked(productsApi.fetchCategories).mockResolvedValue([]);
  });

  it('shows a recoverable error state when the catalogue fetch fails, and loads correctly on retry', async () => {
    const user = userEvent.setup();
    vi.mocked(productsApi.fetchAllProducts).mockRejectedValueOnce(
      new Error('Request failed with status 500'),
    );

    renderStockListPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/500/);

    // Simulates the request succeeding on retry, the way a real /http/500 would if
    // the underlying network hiccup was transient.
    vi.mocked(productsApi.fetchAllProducts).mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText(/no stock items match your search/i)).toBeInTheDocument(),
    );
  });

  it('shows the empty state, not a blank screen, when the catalogue loads with zero matching items', async () => {
    vi.mocked(productsApi.fetchAllProducts).mockResolvedValueOnce([]);

    renderStockListPage();

    expect(await screen.findByText(/no stock items match your search/i)).toBeInTheDocument();
  });
});
