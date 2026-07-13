'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { agentLinks } from '@/components/NavBar';
import { ReportGameFilter } from '@/components/ReportGameFilter';
import { SummaryGrid } from '@/components/SummaryGrid';
import { useSession, apiFetch } from '@/lib/hooks';
import { money } from '@/lib/calculations';
import { gameBadgeClass, gameRowClass, gameTypeLabel } from '@/lib/game-styles';
import type { GameFilter } from '@/lib/game-filter';
import type { GameTotals } from '@/lib/types';

interface HistoryGame {
  id: string;
  gameName: string;
  date: string;
  gameType?: string;
  wonProfit: number;
  netProfit: number;
  expectedToReceive: number;
  received: number;
}

export default function AgentSummaryPage() {
  const { session, loading } = useSession('agent');
  const [totals, setTotals] = useState<GameTotals>({ wonProfit: 0, netProfit: 0, expectedToReceive: 0, received: 0, count: 0 });
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [reportGame, setReportGame] = useState<GameFilter>('all');

  const gq = useCallback((path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}game=${reportGame}`;
  }, [reportGame]);

  const load = useCallback(async () => {
    const datePart = filterDate ? `&date=${filterDate}` : '';
    const [summaryData, historyGames] = await Promise.all([
      apiFetch<{ totals: GameTotals }>(gq(`/api/summary?type=general${datePart}`)),
      apiFetch<HistoryGame[]>('/api/games?completed=true&game=all'),
    ]);
    setTotals(summaryData.totals);
    setHistory(historyGames);
  }, [filterDate, gq]);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={agentLinks}
      userLabel={session?.agentName || 'Agent'}
      logoutRedirect="/login"
      brandHref="/agent/games"
      title="Summary"
      subtitle="Your earnings overview and payment history"
      actions={
        <div className="page-actions-row">
          <ReportGameFilter value={reportGame} onChange={setReportGame} />
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: 'auto' }} />
          {filterDate && <button type="button" className="btn-secondary btn-sm" onClick={() => setFilterDate('')}>Clear</button>}
        </div>
      }
    >
      <div className="card-stack">
        <div className="card">
          <SummaryGrid totals={totals} label={filterDate ? `Summary for ${filterDate}` : 'All-time summary'} />
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Games</div>
            <div className="stat-value">{totals.count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Outstanding</div>
            <div className="stat-value">{money(Math.max(totals.expectedToReceive - totals.received, 0))}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Game History</h3>
            <span className="badge badge-muted">{history.length} completed</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Game</th>
                  <th>Date</th>
                  <th>Won</th>
                  <th>Net</th>
                  <th>Expected</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No completed games yet</td></tr>
                ) : (
                  history.map((g) => (
                    <tr key={g.id} className={gameRowClass(g.gameType)}>
                      <td><strong>{g.gameName}</strong></td>
                      <td><span className={`badge ${gameBadgeClass(g.gameType)}`}>{gameTypeLabel(g.gameType)}</span></td>
                      <td>{g.date}</td>
                      <td>{money(g.wonProfit)}</td>
                      <td>{money(g.netProfit)}</td>
                      <td>{money(g.expectedToReceive)}</td>
                      <td>{money(g.received)}</td>
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
