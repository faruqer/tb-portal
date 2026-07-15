'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { agentLinks } from '@/components/NavBar';
import { LoadingBlock } from '@/components/LoadingBlock';
import { useSession, apiFetch } from '@/lib/hooks';
import { money } from '@/lib/calculations';
import { gameBadgeClass, gameRowClass, gameTypeLabel } from '@/lib/game-styles';

interface Game {
  id: string;
  gameName: string;
  gameType?: string;
  wonProfit: number;
  netProfit: number;
  expectedToReceive: number;
  date: string;
  paymentStatus: string;
}

export default function AgentGamesPage() {
  const { session, loading } = useSession('agent');
  const [games, setGames] = useState<Game[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      setGames(await apiFetch<Game[]>('/api/games?completed=false&game=all'));
      setDataReady(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) load().catch(console.error);
  }, [loading, load]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <AppShell
      links={agentLinks}
      userLabel={session?.agentName || 'Agent'}
      logoutRedirect="/login"
      brandHref="/agent/games"
      title="My Games"
      subtitle="View your active winnings"
    >
      <div className="game-legend">
        <span className="game-legend-item"><span className="game-legend-swatch game-legend-35k" /> 35K</span>
        <span className="game-legend-item"><span className="game-legend-swatch game-legend-20k" /> 20K</span>
      </div>
      <div className="card">
        {!dataReady && dataLoading ? (
          <LoadingBlock label="Loading your games…" />
        ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Game</th>
                <th>Date</th>
                <th>Won</th>
                <th>Net 75%</th>
                <th>Expected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">No active games</td>
                </tr>
              ) : (
                games.map((g) => (
                  <tr key={g.id} className={gameRowClass(g.gameType)}>
                    <td><strong>{g.gameName}</strong></td>
                    <td><span className={`badge ${gameBadgeClass(g.gameType)}`}>{gameTypeLabel(g.gameType)}</span></td>
                    <td>{g.date}</td>
                    <td>{money(g.wonProfit)}</td>
                    <td>{money(g.netProfit)}</td>
                    <td>{money(g.expectedToReceive)}</td>
                    <td>
                      <span className={`badge ${g.paymentStatus === 'paid' ? 'badge-success' : 'badge-muted'}`}>
                        {g.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </AppShell>
  );
}
