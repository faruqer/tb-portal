'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { SummaryGrid } from '@/components/SummaryGrid';
import { DayMetrics } from '@/components/DayMetrics';
import { ReportChart, type ChartData, type MetricKey } from '@/components/ReportChart';
import { ReportGameFilter } from '@/components/ReportGameFilter';
import { LoadingBlock } from '@/components/LoadingBlock';
import { useSession, apiFetch } from '@/lib/hooks';
import { money, addDaysStr, getWeekStartStr, formatDateTime } from '@/lib/calculations';
import { appendDateRangeParams, dateRangeLabel, dateRangeQuery, hasDateRange } from '@/lib/date-range';
import { gameBadgeClass, gameRowClass, gameTypeLabel } from '@/lib/game-styles';
import type { GameFilter } from '@/lib/game-filter';
import type { GameTotals } from '@/lib/types';

interface Agent { id: string; name: string; deletedAt?: string | null; }

interface Game {
  id: string; gameName: string; agentId: string; agentName?: string;
  wonProfit: number; netProfit: number; expectedToReceive: number; received: number;
  date: string; paymentStatus: string; gameType?: string;
  paidAt?: string | null; updatedAt?: string;
}

interface AgentSummary { agentId: string; agentName: string; totals: GameTotals; }

const WEEKDAYS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const VIEWS = ['general', 'weekly', 'history', 'calendar', 'chart'] as const;
type View = typeof VIEWS[number];

export default function ReportPage() {
  const { loading } = useSession('admin');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [historyGames, setHistoryGames] = useState<Game[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [unpayingId, setUnpayingId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [generalFrom, setGeneralFrom] = useState('');
  const [generalTo, setGeneralTo] = useState('');
  const [view, setView] = useState<View>('general');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [weekStart, setWeekStart] = useState(getWeekStartStr());
  const [monthData, setMonthData] = useState<{ byDay: Record<string, GameTotals>; totals: GameTotals } | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [weekData, setWeekData] = useState<{ byDay: Record<string, GameTotals>; totals: GameTotals; weekStart: string; weekEnd: string } | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [agentSummaries, setAgentSummaries] = useState<AgentSummary[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartMetrics, setChartMetrics] = useState<Set<MetricKey>>(new Set(['won', 'net', 'expected', 'received']));
  const [reportGame, setReportGame] = useState<GameFilter>('all');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const gq = useCallback((path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}game=${reportGame}`;
  }, [reportGame]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [agentsData, byAgent] = await Promise.all([
        apiFetch<Agent[]>('/api/agents?includeDeleted=true'),
        apiFetch<AgentSummary[]>(
          gq(`/api/summary?type=by-agent${dateRangeQuery(generalFrom, generalTo)}`)
        ),
      ]);
      setAgents(agentsData);
      setAgentSummaries(byAgent);
      setDataReady(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, [gq, generalFrom, generalTo]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        paymentStatus: 'paid',
        game: reportGame === 'all' ? 'all' : reportGame,
      });
      if (filterAgent) params.set('agentId', filterAgent);
      appendDateRangeParams(params, filterFrom, filterTo);
      const data = await apiFetch<Game[]>(`/api/games?${params}`);
      setHistoryGames(data);
      setHistoryReady(true);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [reportGame, filterAgent, filterFrom, filterTo]);

  useEffect(() => { if (!loading) load().catch(console.error); }, [loading, load]);

  useEffect(() => {
    if (view === 'history' && !loading) {
      loadHistory().catch(console.error);
    }
  }, [view, loading, loadHistory]);

  useEffect(() => {
    if (view === 'calendar' && !loading) {
      setMonthLoading(true);
      apiFetch<{ byDay: Record<string, GameTotals>; totals: GameTotals }>(gq(`/api/summary?type=monthly&month=${month}`))
        .then(setMonthData)
        .catch(console.error)
        .finally(() => setMonthLoading(false));
    }
  }, [view, month, loading, gq]);

  useEffect(() => {
    if (view === 'weekly' && !loading) {
      setWeekLoading(true);
      apiFetch<{ byDay: Record<string, GameTotals>; totals: GameTotals; weekStart: string; weekEnd: string }>(
        gq(`/api/summary?type=weekly&weekStart=${weekStart}`)
      )
        .then(setWeekData)
        .catch(console.error)
        .finally(() => setWeekLoading(false));
    }
  }, [view, weekStart, loading, gq]);

  useEffect(() => {
    if (view === 'chart' && !loading) {
      setChartLoading(true);
      setChartData(null);
      apiFetch<ChartData>(gq(`/api/summary?type=chart&period=${chartPeriod}`))
        .then(setChartData)
        .catch(console.error)
        .finally(() => setChartLoading(false));
    }
  }, [view, chartPeriod, loading, gq]);

  const filteredHistory = historyGames;

  const totals = useMemo(() => {
    if (view === 'general') {
      return agentSummaries.reduce(
        (acc, a) => ({
          wonProfit: acc.wonProfit + a.totals.wonProfit,
          netProfit: acc.netProfit + a.totals.netProfit,
          expectedToReceive: acc.expectedToReceive + a.totals.expectedToReceive,
          received: acc.received + a.totals.received,
          count: acc.count + a.totals.count,
        }),
        { wonProfit: 0, netProfit: 0, expectedToReceive: 0, received: 0, count: 0 } as GameTotals
      );
    }
    return { wonProfit: 0, netProfit: 0, expectedToReceive: 0, received: 0, count: 0 };
  }, [view, agentSummaries]);

  async function markUnpaid(id: string) {
    if (unpayingId) return;
    setUnpayingId(id);
    try {
      await apiFetch(`/api/games/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_unpaid' }),
      });
      setHistoryGames((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
      await loadHistory();
    } finally {
      setUnpayingId(null);
    }
  }

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
      const dateStr = addDaysStr(weekData.weekStart, i);
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
      links={adminLinks}
      userLabel="Admin"
      stickyPageHeader
      title="Reports"
      subtitle="Financial summaries and game history"
      actions={
        <div className="page-actions-row">
          <ReportGameFilter value={reportGame} onChange={setReportGame} />
          <div className="tab-bar tab-bar-scroll">
            {VIEWS.map((v) => (
              <button key={v} type="button" className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {view === 'general' && (
        !dataReady && dataLoading ? (
          <div className="card"><LoadingBlock label="Loading report…" /></div>
        ) : (
        <div className={`card-stack${dataLoading && dataReady ? ' content-refreshing' : ''}`}>
          <div className="card">
            <div className="card-header">
              <h3>{hasDateRange(generalFrom, generalTo) ? dateRangeLabel(generalFrom, generalTo, 'All-time report') : 'All-time report'}</h3>
              <div className="page-actions">
                <label className="label" style={{ margin: 0 }}>From</label>
                <input
                  type="date"
                  value={generalFrom}
                  onChange={(e) => setGeneralFrom(e.target.value)}
                  style={{ width: 'auto' }}
                />
                <label className="label" style={{ margin: 0 }}>To</label>
                <input
                  type="date"
                  value={generalTo}
                  onChange={(e) => setGeneralTo(e.target.value)}
                  style={{ width: 'auto' }}
                />
                {hasDateRange(generalFrom, generalTo) && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => { setGeneralFrom(''); setGeneralTo(''); }}
                  >
                    All time
                  </button>
                )}
              </div>
            </div>
            <SummaryGrid
              totals={totals}
              label={hasDateRange(generalFrom, generalTo) ? dateRangeLabel(generalFrom, generalTo) : 'All-time totals'}
            />
          </div>
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
        )
      )}

      {view === 'weekly' && (
        weekLoading && !weekData ? (
          <div className="card"><LoadingBlock label="Loading week…" /></div>
        ) : (
        <div className={`card-stack${weekLoading && weekData ? ' content-refreshing' : ''}`}>
          <div className="card">
            <div className="card-header">
              <h3>Week of {weekStart}</h3>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(getWeekStartStr(new Date(e.target.value + 'T00:00:00')))} style={{ width: 'auto' }} />
            </div>
            {weekData && <SummaryGrid totals={weekData.totals} label={`${weekData.weekStart} → ${weekData.weekEnd}`} />}
            <div className="week-bar" style={{ marginTop: '1.25rem' }}>{renderWeekBar()}</div>
          </div>
        </div>
        )
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
          {chartLoading || !chartData ? <LoadingBlock label="Loading chart…" compact /> : <ReportChart data={chartData} activeMetrics={chartMetrics} />}
        </div>
      )}

      {view === 'history' && (
        <div className="card-stack">
          <div className="card">
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))' }}>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Agent</label>
                <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                  <option value="">All</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.deletedAt ? ' (deleted)' : ''}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">From</label>
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">To</label>
                <div className="page-actions" style={{ margin: 0 }}>
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                  {hasDateRange(filterFrom, filterTo) && (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                    >
                      All dates
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h3>Paid history</h3>
              <span className="badge badge-muted">{filteredHistory.length} paid</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Game date</th><th>Paid at</th><th>Game</th><th>Agent</th><th>Session</th><th>Won</th><th>Net</th><th>Expected</th><th>Received</th><th></th></tr></thead>
                <tbody>
                  {historyLoading || !historyReady ? (
                    <tr><td colSpan={10}><LoadingBlock label="Loading paid history…" compact /></td></tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan={10} className="empty-state">No paid games found</td></tr>
                  ) : (
                    filteredHistory.map((g) => (
                      <tr key={g.id} className={gameRowClass(g.gameType)}>
                        <td>{g.date}</td>
                        <td>{formatDateTime(g.paidAt ?? g.updatedAt)}</td>
                        <td><span className={`badge ${gameBadgeClass(g.gameType)}`}>{gameTypeLabel(g.gameType)}</span></td>
                        <td>{g.agentName || g.agentId}</td>
                        <td>{g.gameName}</td>
                        <td>{money(g.wonProfit)}</td>
                        <td>{money(g.netProfit)}</td>
                        <td>{money(g.expectedToReceive)}</td>
                        <td>{g.received > 0 ? money(g.received) : '—'}</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={unpayingId === g.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => markUnpaid(g.id)}
                          >
                            {unpayingId === g.id ? '…' : 'Unpaid'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'calendar' && (
        monthLoading && !monthData ? (
          <div className="card"><LoadingBlock label="Loading calendar…" /></div>
        ) : (
        <div className={`card${monthLoading && monthData ? ' content-refreshing' : ''}`}>
          <div className="card-header">
            <h3>Monthly Calendar</h3>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} />
          </div>
          {monthData && <SummaryGrid totals={monthData.totals} />}
          <div className="calendar-grid" style={{ marginTop: '1.25rem' }}>{renderCalendar()}</div>
        </div>
        )
      )}
    </AppShell>
  );
}
