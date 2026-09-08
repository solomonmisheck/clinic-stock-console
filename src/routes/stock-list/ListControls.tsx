import type { ReactNode } from 'react';

export function ListControls({ children }: { children: ReactNode }) {
  return <div className="list-controls cluster">{children}</div>;
}
