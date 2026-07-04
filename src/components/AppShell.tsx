'use client';

import { ReactNode } from 'react';
import { NavBar, NavLink } from '@/components/NavBar';

interface AppShellProps {
  links: NavLink[];
  userLabel?: string;
  logoutRedirect?: string;
  brandHref?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  links,
  userLabel,
  logoutRedirect,
  brandHref,
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <NavBar
        links={links}
        userLabel={userLabel}
        logoutRedirect={logoutRedirect}
        brandHref={brandHref}
      />
      <div className="page-content">
        <div className="page-top">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
