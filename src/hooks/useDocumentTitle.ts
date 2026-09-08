import { useEffect } from 'react';

/**
 * SPA route changes don't reload the document, so screen readers have no natural
 * signal that the "page" changed unless something observable changes -- the document
 * title is the conventional hook for that, paired with the focus move in AppShell.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Clinic stock console`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
