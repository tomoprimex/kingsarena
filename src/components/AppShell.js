'use client';

import { usePathname } from 'next/navigation';
import AuthenticatedLayout from './AuthenticatedLayout';

/* Routes that must stay chrome-free: they own their own full-bleed layout
   (the landing hero, or the centred auth card), so no sidebar is rendered. */
const CHROME_FREE_ROUTES = ['/login', '/signup'];

function isChromeFree(pathname) {
  if (typeof pathname !== 'string') return true;
  if (pathname === '/') return true;

  return CHROME_FREE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}

/* Single client boundary for the whole app: decides once whether the current
   route gets the fixed sidebar shell, so no page ever nests a second shell. */
export default function AppShell({ children }) {
  const pathname = usePathname();

  return isChromeFree(pathname) ? (
    <>{children}</>
  ) : (
    <AuthenticatedLayout>{children}</AuthenticatedLayout>
  );
}
