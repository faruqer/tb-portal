'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { useSession, apiFetch } from '@/lib/hooks';
import { money, amountInput } from '@/lib/calculations';

interface Agent {
  id: string;
  name: string;
}

interface VerifyRequest {
  id: string;
  agentId?: string;
  agentName?: string;
  submittedAmount: number;
  status: string;
  createdAt: string;
  game: {
    id: string;
    gameName: string;
    date: string;
    wonProfit: number;
    expectedToReceive: number;
    netProfit: number;
    received?: number;
  } | null;
}

export default function VerifyPage() {
  const { loading } = useSession('admin');
  const [requests, setRequests] = useState<VerifyRequest[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const url = filterAgent ? `/api/verify?agentId=${filterAgent}` : '/api/verify';
    const [data, agentsData] = await Promise.all([
      apiFetch<VerifyRequest[]>(url),
      apiFetch<Agent[]>('/api/agents'),
    ]);
    setRequests(data);
    setAgents(agentsData);
    const amounts: Record<string, string> = {};
    for (const r of data) {
      if (r.status === 'pending') {
        amounts[r.id] = amountInput(r.submittedAmount);
      }
    }
    setEditAmounts(amounts);
  }, [filterAgent]);

  useEffect(() => {
    if (!loading) load().catch(console.error);
  }, [loading, load]);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'revert') {
    const body: Record<string, unknown> = { id, action };
    if (action === 'approve') {
      body.received = Number(editAmounts[id] ?? 0);
    }
    await apiFetch('/api/verify', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={adminLinks}
      userLabel="Admin"
      title="Verify Payments"
      subtitle="Review amounts agents submitted when marking games as paid"
      actions={
        <>
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {pending.length > 0 && <span className="badge badge-warning">{pending.length} pending</span>}
        </>
      }
    >
      <div className="card-stack">
        <div className="card">
          <div className="card-header"><h3>Pending</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Session</th>
                  <th>Date</th>
                  <th>Won</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No pending requests</td></tr>
                ) : (
                  pending.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.agentName}</strong></td>
                      <td>{r.game?.gameName}</td>
                      <td>{r.game?.date}</td>
                      <td>{money(r.game?.wonProfit ?? 0)}</td>
                      <td>{money(r.game?.expectedToReceive ?? 0)}</td>
                      <td>
                        <input
                          type="number"
                          className="inline-input"
                          min="0"
                          step="1"
                          value={editAmounts[r.id] ?? amountInput(r.submittedAmount)}
                          onChange={(e) => setEditAmounts({ ...editAmounts, [r.id]: e.target.value })}
                        />
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Agent sent: {money(r.submittedAmount)}
                      </td>
                      <td className="action-cell">
                        <button type="button" className="btn-success btn-sm" onClick={() => handleAction(r.id, 'approve')}>Approve</button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => handleAction(r.id, 'reject')}>Reject</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>History</h3></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Session</th>
                  <th>Won</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td>{r.agentName}</td>
                    <td>{r.game?.gameName}</td>
                    <td>{money(r.game?.wonProfit ?? 0)}</td>
                    <td>{money(r.game?.expectedToReceive ?? 0)}</td>
                    <td>{money(r.status === 'approved' ? (r.game?.received ?? r.submittedAmount) : r.submittedAmount)}</td>
                    <td>
                      <span className={`badge ${r.status === 'approved' ? 'badge-success' : 'badge-muted'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {r.status === 'approved' && (
                        <button type="button" className="btn-secondary btn-sm" onClick={() => handleAction(r.id, 'revert')}>
                          Take Back
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
