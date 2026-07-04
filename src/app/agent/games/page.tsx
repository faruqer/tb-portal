'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { agentLinks } from '@/components/NavBar';
import { Modal } from '@/components/Modal';
import { useSession, apiFetch } from '@/lib/hooks';
import { money } from '@/lib/calculations';

interface Game {
  id: string; gameName: string; wonProfit: number; netProfit: number;
  expectedToReceive: number; date: string; paymentStatus: string;
}

export default function AgentGamesPage() {
  const { session, loading } = useSession('agent');
  const [games, setGames] = useState<Game[]>([]);
  const [payModal, setPayModal] = useState<{ id: string; expected: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setGames(await apiFetch<Game[]>('/api/games?completed=false'));
  }, []);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  function openPayModal(game: Game) {
    setPayModal({ id: game.id, expected: game.expectedToReceive });
    setPayAmount(String(game.expectedToReceive));
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/games/${payModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', amount: Number(payAmount) }),
      });
      setPayModal(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={agentLinks}
      userLabel={session?.agentName || 'Agent'}
      logoutRedirect="/agent/login"
      brandHref="/agent/games"
      title="My Games"
      subtitle="Mark games as paid after sending money to admin"
    >
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Session</th><th>Date</th><th>Won</th><th>Net 75%</th><th>Expected</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {games.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No active games</td></tr>
              ) : (
                games.map((g) => (
                  <tr key={g.id}>
                    <td><strong>{g.gameName}</strong></td>
                    <td>{g.date}</td>
                    <td>{money(g.wonProfit)}</td>
                    <td>{money(g.netProfit)}</td>
                    <td>{money(g.expectedToReceive)}</td>
                    <td>
                      <span className={`badge ${g.paymentStatus === 'paid' ? 'badge-success' : g.paymentStatus === 'pending_verify' ? 'badge-warning' : 'badge-muted'}`}>
                        {g.paymentStatus === 'pending_verify' ? 'verify payment' : g.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {g.paymentStatus === 'unpaid' && (
                        <button type="button" className="btn-sm" onClick={() => openPayModal(g)}>I Paid</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!payModal}
        title="Confirm Payment"
        onClose={() => setPayModal(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
            <button type="submit" form="pay-form" disabled={submitting}>{submitting ? 'Sending…' : 'Submit'}</button>
          </>
        }
      >
        <form id="pay-form" onSubmit={submitPayment}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            Enter the exact amount you sent to admin for verification.
          </p>
          <div className="field">
            <label className="label">Expected: {money(payModal?.expected ?? 0)}</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
              min="0"
              step="1"
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
