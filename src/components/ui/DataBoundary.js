'use client';

import { LoadingState, ErrorState, EmptyState } from './States';

export function DataBoundary({ loading, error, isEmpty, onRetry, empty, children }) {
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return empty ?? <EmptyState title='No data' description='There&apos;s nothing here yet.' />;
  }

  return children;
}
