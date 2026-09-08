import type { ReactNode } from 'react';
import { Button } from './Button';
import './AsyncState.css';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="async-state" role="status">
      <span className="async-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="async-state">
      <p className="async-state__title">{title}</p>
      {children}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="async-state async-state--error" role="alert">
      <p className="async-state__title">{title}</p>
      <p>{message}</p>
      <Button variant="danger" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
