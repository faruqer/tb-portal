'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { agentLinks } from '@/components/NavBar';
import { PhoneReveal } from '@/components/PhoneReveal';
import { PhoneRevealProvider, ShowAllNumbersButton } from '@/components/PhoneRevealContext';
import { LoadingBlock } from '@/components/LoadingBlock';
import { useSession, apiFetch } from '@/lib/hooks';
import { formatDateTime } from '@/lib/calculations';
import { sortSims, groupColorClass } from '@/lib/sort-sims';
import type { SimSortMode } from '@/lib/types';

interface Sim {
  id: string; phoneNumber: string; sessionId: number; groupId: string | null;
  lastPlayedDate: string | null; nextPlayingDate: string | null; nextPlayingAt: string | null;
  isAvailable: boolean;
}

export default function AgentNumbersPage() {
  const { session, loading } = useSession('agent');
  const [sims, setSims] = useState<Sim[]>([]);
  const [sortMode, setSortMode] = useState<SimSortMode>('ascending');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      setSims(await apiFetch<Sim[]>('/api/sims'));
      setDataReady(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  const sorted = sortSims(sims, sortMode);

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
      links={agentLinks}
      userLabel={session?.agentName || 'Agent'}
      logoutRedirect="/login"
      brandHref="/agent/games"
      title="My Numbers"
      subtitle="SIM cards assigned to you"
      actions={
        <>
          <ShowAllNumbersButton />
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SimSortMode)} style={{ width: 'auto' }}>
            <option value="ascending">Session ascending</option>
            <option value="grouped">By group</option>
          </select>
        </>
      }
    >
      <div className="card">
        {!dataReady && dataLoading ? (
          <LoadingBlock label="Loading your numbers…" />
        ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Session</th><th>Phone</th><th>Group</th><th>Last Played</th><th>Next Play</th></tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No SIM cards assigned</td></tr>
              ) : (
                sorted.map((s) => (
                  <tr key={s.id} className={groupColorClass(s.groupId)}>
                    <td><strong>{s.sessionId}</strong></td>
                    <td><PhoneReveal phone={s.phoneNumber} /></td>
                    <td>{s.groupId ? <span className="badge-group">{s.groupId}</span> : '—'}</td>
                    <td>{s.lastPlayedDate || '—'}</td>
                    <td>{s.isAvailable ? 'Ready' : formatDateTime(s.nextPlayingAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </AppShell>
    </PhoneRevealProvider>
  );
}
