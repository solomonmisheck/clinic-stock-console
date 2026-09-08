import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui/ToastProvider';
import { AuthProvider } from './lib/auth/AuthContext';
import { AppShell } from './routes/AppShell';
import { ItemDetailPage } from './routes/ItemDetailPage';
import { LoginPage } from './routes/LoginPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { RequireAuth } from './routes/RequireAuth';
import { StockListPage } from './routes/StockListPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/stock" element={<StockListPage />} />
                <Route path="/items/:id" element={<ItemDetailPage />} />
                <Route path="/" element={<Navigate to="/stock" replace />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
