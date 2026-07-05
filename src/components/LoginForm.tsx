'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role === 'agent') router.replace('/agent/games');
        else if (data?.role === 'admin') router.replace('/games');
      })
      .catch(() => null);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Login failed');
      return;
    }
    router.replace(data.role === 'agent' ? '/agent/games' : '/games');
  }

  return (
    <div className="page-center">
      <div className="login-card">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span className="navbar-brand-icon">RM</span>
            <h1 style={{ margin: 0 }}>Sign In</h1>
          </div>
          <p className="subtitle">
            One login for admin and agents — switch between 35K and 20K Win after signing in
          </p>
          <div className="field">
            <label className="label">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
