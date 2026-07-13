'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { Modal } from '@/components/Modal';
import { useSession, apiFetch } from '@/lib/hooks';
import { calcExpectedToReceive, calcNetProfit, money, amountInput } from '@/lib/calculations';

interface Agent {
  id: string;
  name: string;
}

interface Game {
  id: string;
  gameName: string;
  sessionId: number;
  agentId: string;
  wonProfit: number;
  netProfit: number;
  expectedToReceive: number;
  date: string;
  paymentStatus: string;
}

function enterOrBlur(
  e: React.KeyboardEvent<HTMLInputElement>,
  commit: () => void,
  skipBlurRef: React.MutableRefObject<boolean>
) {
  if (e.key === 'Enter') {
    e.preventDefault();
    skipBlurRef.current = true;
    commit();
  }
}

function blurCommit(commit: () => void, skipBlurRef: React.MutableRefObject<boolean>) {
  if (skipBlurRef.current) {
    skipBlurRef.current = false;
    return;
  }
  commit();
}

function GameRow({
  game,
  onUpdate,
  onDelete,
  onMarkPaid,
  markingPaid,
}: {
  game: Game;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  markingPaid: boolean;
}) {
  const skipBlur = useRef(false);
  const [won, setWon] = useState(amountInput(game.wonProfit));
  const [expected, setExpected] = useState(amountInput(game.expectedToReceive));
  const [date, setDate] = useState(game.date);

  useEffect(() => {
    setWon(amountInput(game.wonProfit));
    setExpected(amountInput(game.expectedToReceive));
    setDate(game.date);
  }, [game.id, game.wonProfit, game.expectedToReceive, game.date]);

  const net = calcNetProfit(Number(won) || 0);

  const commitWon = useCallback(async () => {
    const w = Number(won) || 0;
    if (w === game.wonProfit) return;
    const exp = calcExpectedToReceive(calcNetProfit(w));
    setExpected(amountInput(exp));
    await onUpdate(game.id, { wonProfit: w });
  }, [won, game.wonProfit, game.id, onUpdate]);

  const commitExpected = useCallback(async () => {
    const exp = Number(expected) || 0;
    if (exp === game.expectedToReceive) return;
    await onUpdate(game.id, { expectedToReceive: exp });
  }, [expected, game.expectedToReceive, game.id, onUpdate]);

  const commitDate = useCallback(async () => {
    if (date === game.date) return;
    await onUpdate(game.id, { date });
  }, [date, game.date, game.id, onUpdate]);

  return (
    <tr>
      <td>
        <strong>{game.gameName}</strong>
        {game.paymentStatus === 'paid' && (
          <span className="badge badge-success" style={{ marginLeft: '0.4rem' }}>paid</span>
        )}
      </td>
      <td>
        <input
          type="date"
          className="inline-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={(e) => enterOrBlur(e, commitDate, skipBlur)}
          onBlur={() => blurCommit(commitDate, skipBlur)}
        />
      </td>
      <td>
        <input
          type="number"
          className="inline-input"
          value={won}
          onChange={(e) => setWon(e.target.value)}
          onKeyDown={(e) => enterOrBlur(e, commitWon, skipBlur)}
          onBlur={() => blurCommit(commitWon, skipBlur)}
        />
      </td>
      <td>{money(net)}</td>
      <td>
        <input
          type="number"
          className="inline-input"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          onKeyDown={(e) => enterOrBlur(e, commitExpected, skipBlur)}
          onBlur={() => blurCommit(commitExpected, skipBlur)}
        />
      </td>
      <td className="row-actions">
        {game.paymentStatus !== 'paid' && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={markingPaid}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onMarkPaid(game.id)}
          >
            {markingPaid ? '…' : 'Paid'}
          </button>
        )}
        <button type="button" className="btn-danger btn-sm" onClick={() => onDelete(game.id)}>Delete</button>
      </td>
    </tr>
  );
}

export default function AdminGamesPage() {
  const { loading } = useSession('admin');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [todayStats, setTodayStats] = useState({ wonToday: 0, expectedToday: 0, totalSims: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [sessions, setSessions] = useState<number[]>([]);
  const [copyModal, setCopyModal] = useState<{ agentId: string; agentName: string } | null>(null);
  const [copyGames, setCopyGames] = useState<Game[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    agentId: '',
    sessionId: '',
    wonProfit: '0',
    date: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    const [agentsData, gamesData, todayData] = await Promise.all([
      apiFetch<Agent[]>('/api/agents'),
      apiFetch<Game[]>('/api/games?completed=false'),
      apiFetch<{ wonToday: number; expectedToday: number; totalSims: number }>(
        '/api/summary?type=today-progress'
      ),
    ]);
    setAgents(agentsData);
    setGames(gamesData);
    setTodayStats(todayData);
  }, []);

  useEffect(() => {
    if (!loading) load().catch(console.error);
  }, [loading, load]);

  useEffect(() => {
    if (!form.agentId) {
      setSessions([]);
      return;
    }
    apiFetch<number[]>(`/api/agents/${form.agentId}/sessions?available=true`)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [form.agentId]);

  const gamesByAgent = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      const list = map.get(g.agentId) || [];
      list.push(g);
      map.set(g.agentId, list);
    }
    return map;
  }, [games]);

  const updateGame = useCallback(async (id: string, updates: Record<string, unknown>) => {
    await apiFetch(`/api/games/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await load();
  }, [load]);

  const markPaid = useCallback(async (id: string) => {
    if (payingId) return;
    setPayingId(id);
    try {
      await apiFetch(`/api/games/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid' }),
      });
      setGames((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
      await load();
    } finally {
      setPayingId(null);
    }
  }, [payingId, load]);

  const deleteGame = useCallback(async (id: string) => {
    if (!confirm('Delete this game?')) return;
    await apiFetch(`/api/games/${id}`, { method: 'DELETE' });
    await load();
  }, [load]);

  const agentsWithGames = useMemo(
    () => agents.filter((a) => (gamesByAgent.get(a.id) || []).length > 0),
    [agents, gamesByAgent]
  );

  function openCopyModal(agent: Agent) {
    setCopyMsg('');
    setCopyModal({ agentId: agent.id, agentName: agent.name });
    const active = gamesByAgent.get(agent.id) || [];
    setCopyGames(active);
    setSelectedCopy(new Set(active.map((g) => g.id)));
  }

  function toggleCopy(id: string) {
    setSelectedCopy((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copySelected() {
    const lines = copyGames
      .filter((g) => selectedCopy.has(g.id))
      .map((g) => `${g.sessionId ?? g.gameName},${g.netProfit}`);
    const text = lines.join('\n');
    await navigator.clipboard.writeText(text);
    setCopyMsg(`Copied ${lines.length} line(s)`);
  }

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    const won = Number(form.wonProfit) || 0;
    await apiFetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: form.agentId,
        sessionId: Number(form.sessionId),
        wonProfit: won,
        expectedToReceive: calcExpectedToReceive(calcNetProfit(won)),
        date: form.date,
      }),
    });
    setModalOpen(false);
    setForm({ agentId: '', sessionId: '', wonProfit: '0', date: new Date().toISOString().slice(0, 10) });
    await load();
  }

  const won = Number(form.wonProfit) || 0;
  const net = calcNetProfit(won);
  const expected = calcExpectedToReceive(net);

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={adminLinks}
      userLabel="Admin"
      showGameTabs
      title="Games"
      subtitle="Track active winnings per agent"
      actions={
        <div className="games-actions-col">
          <button type="button" onClick={() => setModalOpen(true)}>
            + Add Winning
          </button>
          <div className="games-today-stats">
            <span>
              Won today: <strong>{todayStats.wonToday}</strong>
            </span>
            <span className="games-today-stats-sep">·</span>
            <span>
              Expected: <strong>{todayStats.expectedToday.toFixed(1)}</strong>
              <span className="games-today-stats-hint"> ({todayStats.totalSims} SIMs ÷ 7)</span>
            </span>
          </div>
        </div>
      }
    >
      <div className="card-stack">
        {agentsWithGames.length === 0 ? (
          <div className="card">
            <div className="empty-state">No active games</div>
          </div>
        ) : (
          agentsWithGames.map((agent) => {
            const agentGames = gamesByAgent.get(agent.id) || [];
            return (
              <div key={agent.id} className="card">
                <div className="card-header">
                  <h3>{agent.name}</h3>
                  <div className="card-header-actions">
                    <span className="badge badge-muted">{agentGames.length} active</span>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Copy active games"
                      onClick={() => openCopyModal(agent)}
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Date</th>
                        <th>Won</th>
                        <th>Net 75%</th>
                        <th>Expected</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentGames.map((g) => (
                        <GameRow
                          key={g.id}
                          game={g}
                          onUpdate={updateGame}
                          onDelete={deleteGame}
                          onMarkPaid={markPaid}
                          markingPaid={payingId === g.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={modalOpen}
        title="Add Game Winning"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="add-game-form">Add Winning</button>
          </>
        }
      >
        <form id="add-game-form" className="form-grid" onSubmit={addGame}>
          <div className="field">
            <label className="label">Agent</label>
            <select
              value={form.agentId}
              onChange={(e) => setForm({ ...form, agentId: e.target.value, sessionId: '' })}
              required
            >
              <option value="">Select agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Session ID (available only)</label>
            <select
              value={form.sessionId}
              onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
              required
              disabled={!form.agentId}
            >
              <option value="">{sessions.length === 0 ? 'No available sessions' : 'Select session…'}</option>
              {sessions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="two-col form-grid">
            <div className="field">
              <label className="label">Won Amount</label>
              <input
                type="number"
                min="0"
                value={form.wonProfit}
                onChange={(e) => setForm({ ...form, wonProfit: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="label">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>
          <div className="two-col form-grid">
            <div className="field">
              <label className="label">Net (75%) — auto</label>
              <input readOnly value={money(net)} />
            </div>
            <div className="field">
              <label className="label">Expected (50%) — auto</label>
              <input readOnly value={money(expected)} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!copyModal}
        title={copyModal ? `Active games — ${copyModal.agentName}` : 'Active games'}
        onClose={() => setCopyModal(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCopyModal(null)}>Close</button>
            <button type="button" onClick={copySelected} disabled={selectedCopy.size === 0}>
              Copy selected
            </button>
          </>
        }
      >
        {copyGames.length === 0 ? (
          <p className="empty-state" style={{ padding: '1rem 0' }}>No active games for this agent.</p>
        ) : (
          <div className="copy-checklist">
            <p className="copy-hint">Format: session,Net — one per line</p>
            {copyGames.map((g) => (
              <label key={g.id} className="copy-check-item">
                <input
                  type="checkbox"
                  checked={selectedCopy.has(g.id)}
                  onChange={() => toggleCopy(g.id)}
                />
                <span>
                  <strong>{g.gameName}</strong>
                  <span className="copy-meta"> — Net {money(g.netProfit)} · {g.date}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {copyMsg && <p className="copy-success">{copyMsg}</p>}
      </Modal>
    </AppShell>
  );
}
