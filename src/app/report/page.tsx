'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { SummaryGrid } from '@/components/SummaryGrid';
import { DayMetrics } from '@/components/DayMetrics';
import { ReportChart, type ChartData, type MetricKey } from '@/components/ReportChart';
import { useSession, apiFetch } from '@/lib/hooks';
import { money } from '@/lib/calculations';
import type { GameTotals } from '@/lib/types';

interface Agent { id: string; name: string; }

interface Game {
  id: string; gameName: string; agentId: string; agentName?: string;
  wonProfit: number; netProfit: number; expectedToReceive: number; received: number;
  date: string; paymentStatus: string;
}

interface AgentSummary { agentId: string; agentName: string; totals: GameTotals; }

function getWeekStart(d = new Date()): string {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy.toISOString().slice(0, 10);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VIEWS = ['general', 'weekly', 'history', 'calendar', 'chart'] as const;
type View = typeof VIEWS[number];

export default function ReportPage() {
  const { loading } = useSession('admin');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [view, setView] = useState<View>('general');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [monthData, setMonthData] = useState<{ byDay: Record<string, GameTotals>; totals: GameTotals } | null>(null);
  const [weekData, setWeekData] = useState<{ byDay: Record<string, GameTotals>; totals: GameTotals; weekStart: string; weekEnd: string } | null>(null);
  const [agentSummaries, setAgentSummaries] = useState<AgentSummary[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartMetrics, setChartMetrics] = useState<Set<MetricKey>>(new Set(['won', 'net', 'expected', 'received']));

  const load = useCallback(async () => {
    const [agentsData, gamesData, byAgent] = await Promise.all([
      apiFetch<Agent[]>('/api/agents'),
      apiFetch<Game[]>('/api/games'),
      apiFetch<AgentSummary[]>('/api/summary?type=by-agent'),
    ]);
    setAgents(agentsData);
    setGames(gamesData);
    setAgentSummaries(byAgent);
  }, []);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  useEffect(() => {
    if (view === 'calendar' && !loading) {
      apiFetch<{ byDay: Record<string, GameTotals>; totals: GameTotals }>(`/api/summary?type=monthly&month=${month}`)
        .then(setMonthData).catch(console.error);
    }
  }, [view, month, loading]);

  useEffect(() => {
    if (view === 'weekly' && !loading) {
      apiFetch<{ byDay: Record<string, GameTotals>; totals: GameTotals; weekStart: string; weekEnd: string }>(
        `/api/summary?type=weekly&weekStart=${weekStart}`
      ).then(setWeekData).catch(console.error);
    }
  }, [view, weekStart, loading]);

  useEffect(() => {
    if (view === 'chart' && !loading) {
      apiFetch<ChartData>(`/api/summary?type=chart&period=${chartPeriod}`)
        .then(setChartData).catch(console.error);
    }
  }, [view, chartPeriod, loading]);

  const filteredGames = useMemo(() => games.filter((g) => {
    if (filterAgent && g.agentId !== filterAgent) return false;
    if (filterDate && g.date !== filterDate) return false;
    return true;
  }), [games, filterAgent, filterDate]);

  const totals = useMemo(() => filteredGames.reduce(
    (acc, g) => ({
      wonProfit: acc.wonProfit + g.wonProfit, netProfit: acc.netProfit + g.netProfit,
      expectedToReceive: acc.expectedToReceive + g.expectedToReceive,
      received: acc.received + g.received, count: acc.count + 1,
    }),
    { wonProfit: 0, netProfit: 0, expectedToReceive: 0, received: 0, count: 0 } as GameTotals
  ), [filteredGames]);

  function toggleMetric(key: MetricKey) {
    setChartMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function renderCalendar() {
    const [y, m] = month.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startPad = (firstDay.getDay() + 6) % 7;
    const cells: React.ReactNode[] = [];
    for (const wd of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']) {
      cells.push(<div key={wd} className="calendar-weekday">{wd}</div>);
    }
    for (let i = 0; i < startPad; i++) cells.push(<div key={`p${i}`} className="calendar-day muted" />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2,'0')}`;
      const dayData = monthData?.byDay[dateStr];
      cells.push(
        <div key={dateStr} className={`calendar-day ${dayData ? 'has-profit' : ''}`}>
          <div className="day-num">{d}</div>
          {dayData && <DayMetrics data={dayData} compact />}
        </div>
      );
    }
    return cells;
  }

  function renderWeekBar() {
    if (!weekData) return null;
    const days: React.ReactNode[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekData.weekStart + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const data = weekData.byDay[dateStr];
      days.push(
        <div key={dateStr} className={`week-day-card ${data ? 'has-data' : ''}`}>
          <div className="day-label">{WEEKDAYS[i]}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{dateStr.slice(5)}</div>
          {data ? <DayMetrics data={data} /> : <div className="day-val">—</div>}
        </div>
      );
    }
    return days;
  }

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={adminLinks}
      userLabel="Admin"
      title="Reports"
      subtitle="Financial summaries and game history"
      actions={
        <div className="tab-bar tab-bar-scroll">
          {VIEWS.map((v) => (
            <button key={v} type="button" className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      {view === 'general' && (
        <div className="card-stack">
          <div className="card"><SummaryGrid totals={totals} label="All-time totals" /></div>
          <div className="card">
            <div className="card-header"><h3>Per Agent</h3></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Agent</th><th>Games</th><th>Won</th><th>Net</th><th>Expected</th><th>Received</th></tr></thead>
                <tbody>
                  {agentSummaries.map((a) => (
                    <tr key={a.agentId}>
                      <td><strong>{a.agentName}</strong></td>
                      <td>{a.totals.count}</td>
                      <td>{money(a.totals.wonProfit)}</td>
                      <td>{money(a.totals.netProfit)}</td>
                      <td>{money(a.totals.expectedToReceive)}</td>
                      <td>{money(a.totals.received)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'weekly' && (
        <div className="card-stack">
          <div className="card">
            <div className="card-header">
              <h3>Week of {weekStart}</h3>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(getWeekStart(new Date(e.target.value + 'T00:00:00')))} style={{ width: 'auto' }} />
            </div>
            {weekData && <SummaryGrid totals={weekData.totals} label={`${weekData.weekStart} → ${weekData.weekEnd}`} />}
            <div className="week-bar" style={{ marginTop: '1.25rem' }}>{renderWeekBar()}</div>
          </div>
        </div>
      )}

      {view === 'chart' && (
        <div className="card">
          <div className="card-header">
            <h3>Trends</h3>
            <div className="page-actions">
              <select value={chartPeriod} onChange={(e) => setChartPeriod(e.target.value as 'day' | 'week' | 'month')} style={{ width: 'auto' }}>
                <option value="day">By Day</option>
                <option value="week">By Week</option>
                <option value="month">By Month</option>
              </select>
            </div>
          </div>
          <div className="chart-metric-toggles">
            {(['won', 'net', 'expected', 'received'] as MetricKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`btn-sm ${chartMetrics.has(key) ? '' : 'btn-secondary'}`}
                onClick={() => toggleMetric(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          {chartData ? <ReportChart data={chartData} activeMetrics={chartMetrics} /> : <div className="empty-state">Loading chart…</div>}
        </div>
      )}

      {view === 'history' && (
        <div className="card-stack">
          <div className="card">
            <div className="two-col form-grid">
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Agent</label>
                <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                  <option value="">All</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Date</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="card"><SummaryGrid totals={totals} label={`${filteredGames.length} games`} /></div>
          <div className="card">
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Agent</th><th>Session</th><th>Won</th><th>Net</th><th>Expected</th><th>Received</th><th>Payment</th></tr></thead>
                <tbody>
                  {filteredGames.map((g) => (
                    <tr key={g.id}>
                      <td>{g.date}</td>
                      <td>{g.agentName || g.agentId}</td>
                      <td>{g.gameName}</td>
                      <td>{money(g.wonProfit)}</td>
                      <td>{money(g.netProfit)}</td>
                      <td>{money(g.expectedToReceive)}</td>
                      <td>{g.received > 0 ? money(g.received) : '—'}</td>
                      <td><span className={`badge badge-${g.paymentStatus === 'paid' ? 'success' : g.paymentStatus === 'pending_verify' ? 'warning' : 'muted'}`}>{g.paymentStatus === 'pending_verify' ? 'verify payment' : g.paymentStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <div className="card">
          <div className="card-header">
            <h3>Monthly Calendar</h3>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} />
          </div>
          {monthData && <SummaryGrid totals={monthData.totals} />}
          <div className="calendar-grid" style={{ marginTop: '1.25rem' }}>{renderCalendar()}</div>
        </div>
      )}
    </AppShell>
  );
}
