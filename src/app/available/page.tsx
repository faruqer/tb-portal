'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { PhoneReveal } from '@/components/PhoneReveal';
import { useSession, apiFetch } from '@/lib/hooks';
import { formatDateTime } from '@/lib/calculations';
import { sortSims, groupColorClass } from '@/lib/sort-sims';

interface Agent { id: string; name: string; }

interface Sim {
  id: string; agentId: string; agentName?: string;
  phoneNumber: string; sessionId: number; groupId: string | null;
  lastPlayedDate: string | null; nextPlayingDate: string | null; nextPlayingAt: string | null; isAvailable: boolean;
}

interface SimSummary {
  total: number;
  inUse: number;
  free: number;
}

export default function AvailablePage() {
  const { loading } = useSession('admin');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sims, setSims] = useState<Sim[]>([]);
  const [simSummary, setSimSummary] = useState<SimSummary>({ total: 0, inUse: 0, free: 0 });
  const [filterAgent, setFilterAgent] = useState('');

  const load = useCallback(async () => {
    const [agentsData, simsData, summary] = await Promise.all([
      apiFetch<Agent[]>('/api/agents'),
      apiFetch<Sim[]>('/api/sims?available=true'),
      apiFetch<SimSummary>('/api/summary?type=sims'),
    ]);
    setAgents(agentsData);
    setSims(simsData);
    setSimSummary(summary);
  }, []);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  const filtered = useMemo(() => {
    let list = sims;
    if (filterAgent) list = list.filter((s) => s.agentId === filterAgent);
    return sortSims(list, 'by-agent-group');
  }, [sims, filterAgent]);

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={adminLinks}
      userLabel="Admin"
      title="Available SIMs"
      subtitle="Cards ready to play — updated automatically when winnings are added"
      actions={
        <div className="sim-summary-badges">
          <span className="badge badge-muted">Total {simSummary.total}</span>
          <span className="badge badge-warning">In use {simSummary.inUse}</span>
          <span className="badge badge-success">Available {simSummary.free}</span>
        </div>
      }
    >
      <div className="card-stack">
        <div className="card">
          <div className="field" style={{ margin: 0, maxWidth: '320px' }}>
            <label className="label">Agent</label>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
              <option value="">All agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Ready to play</h3>
            <span className="badge badge-muted">{filtered.length} shown · sorted by agent, then group</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Session</th><th>Phone</th><th>Group</th><th>Last Played</th><th>Next Play</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No available SIM cards right now</td></tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className={groupColorClass(s.groupId)}>
                      <td>{s.agentName}</td>
                      <td><strong>{s.sessionId}</strong></td>
                      <td><PhoneReveal phone={s.phoneNumber} /></td>
                      <td>{s.groupId ? <span className="badge-group">{s.groupId}</span> : '—'}</td>
                      <td>{s.lastPlayedDate || 'Never'}</td>
                      <td>{s.isAvailable ? 'Ready' : formatDateTime(s.nextPlayingAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
