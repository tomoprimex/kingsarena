'use client';

import { useRouter } from 'next/navigation';

export function useRevalidate() {
  const router = useRouter();
  return () => router.refresh();
}