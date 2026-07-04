'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormProps {
  role: 'admin' | 'agent';
  title: string;
  subtitle: string;
  redirectTo: string;
}

export function LoginForm({ role, title, subtitle, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth').then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (data?.role === role) router.replace(redirectTo);
    }).catch(() => null);
  }, [role, redirectTo, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Login failed'); return; }
    router.replace(redirectTo);
  }

  return (
    <div className="page-center">
      <form className="login-card" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
          <span className="navbar-brand-icon">RM</span>
          <h1 style={{ margin: 0 }}>{title}</h1>
        </div>
        <p className="subtitle">{subtitle}</p>
        <div className="field">
          <label className="label">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
        </div>
        <div className="field">
          <label className="label">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
