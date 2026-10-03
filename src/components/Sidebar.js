'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import styles from './Sidebar.module.css';

const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/tournaments', label: 'Tournaments' },
      { href: '/rankings', label: 'Rankings' },
      { href: '/teams', label: 'Teams' },
    ],
  },
  {
    title: 'Browse',
    items: [
      { href: '/community', label: 'Community' },
      { href: '/players', label: 'Players' },
      { href: '/statistics', label: 'Statistics' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/profile', label: 'Profile' },
      { href: '/settings', label: 'Settings' },
    ],
  },
];

const isRouteActive = (pathname, href) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuBtnRef = useRef(null);
  const closeBtnRef = useRef(null);
  const wasOpenRef = useRef(false);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
    setIsMenuOpen(false);
  };

  // Close the drawer whenever the route changes (adjust state during render
  // instead of an effect, so navigation does not cause a cascading render).
  const [trackedPathname, setTrackedPathname] = useState(pathname);
  if (trackedPathname !== pathname) {
    setTrackedPathname(pathname);
    setIsMenuOpen(false);
  }

  // Move focus into the drawer on open, and back to the hamburger on close.
  useEffect(() => {
    if (isMenuOpen) {
      closeBtnRef.current?.focus();
    } else if (wasOpenRef.current) {
      menuBtnRef.current?.focus();
    }
    wasOpenRef.current = isMenuOpen;
  }, [isMenuOpen]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, closeMenu]);

  // Prevent the page behind the drawer from scrolling.
  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Hamburger menu button - mobile only (hidden at 1024px and up) */}
      <button
        ref={menuBtnRef}
        type="button"
        className={styles.mobileMenuBtn}
        onClick={openMenu}
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
        aria-controls="sidebar-drawer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
      {isMenuOpen && (
        <div className={styles.mobileOverlay} onClick={closeMenu} />
      )}

      {/* Slide-in drawer */}
      <div
        id="sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isMenuOpen}
        className={`${styles.drawer} ${isMenuOpen ? styles.drawerOpen : ''}`}
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className={styles.drawerNav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className={styles.drawerSection}>
              <h3 className={styles.drawerSectionTitle}>{section.title}</h3>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isRouteActive(pathname, item.href) ? 'page' : undefined}
                  className={`${styles.drawerLink} ${
                    isRouteActive(pathname, item.href) ? styles.drawerLinkActive : ''
                  }`}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.drawerFooter}>
          {user && (
            <button type="button" onClick={handleLogout} className={styles.drawerLogout}>
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Fixed desktop rail */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.sidebarLogo}>
            <span className={styles.sidebarLogoIcon}>👑</span>
            <span className={styles.sidebarLogoText}>KINGS ARENA</span>
          </Link>
        </div>

        <nav className={styles.sidebarNav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className={styles.sidebarSection}>
              <h3 className={styles.sidebarSectionTitle}>{section.title}</h3>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isRouteActive(pathname, item.href) ? 'page' : undefined}
                  className={`${styles.sidebarLink} ${
                    isRouteActive(pathname, item.href) ? styles.sidebarLinkActive : ''
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {user && (
            <button type="button" onClick={handleLogout} className={styles.sidebarLogout}>
              Logout
            </button>
          )}
        </div>
      </aside>
    </>
  );
}