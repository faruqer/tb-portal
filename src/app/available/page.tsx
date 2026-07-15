'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { PhoneReveal } from '@/components/PhoneReveal';
import { PhoneRevealProvider, ShowAllNumbersButton } from '@/components/PhoneRevealContext';
import { LoadingBlock } from '@/components/LoadingBlock';
import { useSession, apiFetch } from '@/lib/hooks';
import { formatDateTime, isCooldownDueLaterToday } from '@/lib/calculations';
import { sortSims, groupColorClass } from '@/lib/sort-sims';
import type { SimSortMode } from '@/lib/types';

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

function SimTable({ sims, emptyMessage }: { sims: Sim[]; emptyMessage: string }) {
  if (sims.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr><th>Agent</th><th>Session</th><th>Phone</th><th>Group</th><th>Last Played</th><th>Next Play</th></tr>
        </thead>
        <tbody>
          {sims.map((s) => (
            <tr
              key={s.id}
              className={[groupColorClass(s.groupId), isCooldownDueLaterToday(s) ? 'sim-due-today' : ''].filter(Boolean).join(' ')}
              title={isCooldownDueLaterToday(s) ? 'Available later today — play when the time is reached' : undefined}
            >
              <td>{s.agentName}</td>
              <td><strong>{s.sessionId}</strong></td>
              <td><PhoneReveal phone={s.phoneNumber} /></td>
              <td>{s.groupId ? <span className="badge-group">{s.groupId}</span> : '—'}</td>
              <td>{s.lastPlayedDate || 'Never'}</td>
              <td>{s.isAvailable ? 'Ready' : formatDateTime(s.nextPlayingAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AvailablePage() {
  const { loading } = useSession('admin');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sims, setSims] = useState<Sim[]>([]);
  const [simSummary, setSimSummary] = useState<SimSummary>({ total: 0, inUse: 0, free: 0 });
  const [filterAgent, setFilterAgent] = useState('');
  const [sortMode, setSortMode] = useState<SimSortMode>('ascending');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [agentsData, simsData, summary] = await Promise.all([
        apiFetch<Agent[]>('/api/agents'),
        apiFetch<Sim[]>('/api/sims'),
        apiFetch<SimSummary>('/api/summary?type=sims'),
      ]);
      setAgents(agentsData);
      setSims(simsData);
      setSimSummary(summary);
      setDataReady(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  useEffect(() => {
    const onGameChange = () => { load().catch(console.error); };
    window.addEventListener('rm-game-change', onGameChange);
    return () => window.removeEventListener('rm-game-change', onGameChange);
  }, [load]);

  const filtered = useMemo(() => {
    let list = sims;
    if (filterAgent) list = list.filter((s) => s.agentId === filterAgent);
    return list;
  }, [sims, filterAgent]);

  const availableSims = useMemo(
    () => sortSims(filtered.filter((s) => s.isAvailable), sortMode),
    [filtered, sortMode]
  );

  const waitingSims = useMemo(
    () => sortSims(filtered.filter((s) => !s.isAvailable && s.lastPlayedDate), sortMode),
    [filtered, sortMode]
  );

  const sortLabel = sortMode === 'grouped' ? 'by group, then ascending' : 'session ID ascending';

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <PhoneRevealProvider>
      <AppShell
        links={adminLinks}
        userLabel="Admin"
        showGameTabs
        title="Available SIMs"
        subtitle="Cards ready to play — updated automatically when winnings are added"
        actions={
          <div className="sim-summary-badges">
            <ShowAllNumbersButton />
            <span className="badge badge-muted">Total {simSummary.total}</span>
            <span className="badge badge-warning">In use {simSummary.inUse}</span>
            <span className="badge badge-success">Available {simSummary.free}</span>
          </div>
        }
      >
        <div className={`card-stack${dataLoading && dataReady ? ' content-refreshing' : ''}`}>
          {!dataReady && dataLoading ? (
            <div className="card"><LoadingBlock label="Loading available SIMs…" /></div>
          ) : (
          <>
          <div className="card">
            <div className="two-col form-grid">
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Agent</label>
                <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                  <option value="">All agents</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Sort SIM cards</label>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SimSortMode)}>
                  <option value="ascending">Session ID ascending</option>
                  <option value="grouped">By group, then ascending</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Ready to play</h3>
              <span className="badge badge-muted">{availableSims.length} · {sortLabel}</span>
            </div>
            <SimTable sims={availableSims} emptyMessage="No available SIM cards right now" />
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Waiting for 7-day cooldown</h3>
              <span className="badge badge-warning">{waitingSims.length} · {sortLabel}</span>
              {waitingSims.some(isCooldownDueLaterToday) && (
                <span className="badge sim-due-today-badge">Red border = due later today</span>
              )}
            </div>
            <SimTable sims={waitingSims} emptyMessage="No SIM cards on cooldown" />
          </div>
          </>
          )}
        </div>
      </AppShell>
    </PhoneRevealProvider>
  );
}
