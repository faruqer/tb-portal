'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export interface NavLink {
  href: string;
  label: string;
}

interface NavBarProps {
  links: NavLink[];
  userLabel?: string;
  logoutRedirect?: string;
  brandHref?: string;
}

export function NavBar({ links, userLabel, logoutRedirect = '/login', brandHref = '/games' }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = userLabel?.charAt(0).toUpperCase() || '?';

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push(logoutRedirect);
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href={brandHref} className="navbar-brand">
          <span className="navbar-brand-icon">RM</span>
          Reward Manager
        </Link>

        <nav className="navbar-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? 'active' : ''}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="navbar-right">
          {userLabel && (
            <div className="navbar-user">
              <span className="navbar-avatar">{initial}</span>
              {userLabel}
            </div>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export const adminLinks: NavLink[] = [
  { href: '/games', label: 'Games' },
  { href: '/report', label: 'Report' },
  { href: '/agents', label: 'Agents' },
  { href: '/available', label: 'Available' },
  { href: '/verify', label: 'Verify' },
];

export const agentLinks: NavLink[] = [
  { href: '/agent/games', label: 'Games' },
  { href: '/agent/summary', label: 'Summary' },
  { href: '/agent/numbers', label: 'Numbers' },
];
