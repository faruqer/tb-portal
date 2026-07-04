'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionPayload } from '@/lib/types';

export function useSession(requiredRole?: 'admin' | 'agent') {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          router.replace(requiredRole === 'agent' ? '/login' : '/admin/login');
          return;
        }
        if (requiredRole && data.role !== requiredRole) {
          router.replace(data.role === 'agent' ? '/agent/games' : '/games');
          return;
        }
        setSession(data);
        setLoading(false);
      })
      .catch(() => router.replace(requiredRole === 'agent' ? '/login' : '/admin/login'));
  }, [requiredRole, router]);

  return { session, loading };
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}
