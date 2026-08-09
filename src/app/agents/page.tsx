'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { Modal } from '@/components/Modal';
import { PhoneReveal } from '@/components/PhoneReveal';
import { PhoneRevealProvider, ShowAllNumbersButton } from '@/components/PhoneRevealContext';
import { LoadingBlock } from '@/components/LoadingBlock';
import { useSession, apiFetch } from '@/lib/hooks';
import { fromDatetimeLocal, toDatetimeLocal, formatDateTime } from '@/lib/calculations';
import { sortSims, groupColorClass } from '@/lib/sort-sims';
import { blurOnEnter } from '@/lib/inline-edit';
import { formatSyncStatus } from '@/lib/session-sync';
import type { SimSortMode } from '@/lib/types';

interface Agent {
  id: string;
  name: string;
  username: string;
  lastSessionSyncAt?: string | null;
}

interface SyncQueueItem {
  simId: string;
  agentId: string;
  agentName: string;
  sessionId: number;
  phoneNumber: string;
}

interface SyncAgentOption {
  id: string;
  name: string;
  username: string;
  lastSessionSyncAt: string | null;
  tokenCount: number;
}

interface SessionUploadResult {
  filename: string;
  sessionId: number | null;
  phoneNumber: string | null;
  ok: boolean;
  message: string;
}

interface SyncLogEntry {
  agentName: string;
  sessionId: number;
  phoneNumber: string;
  ok: boolean;
  message: string;
  coins: number | null;
}

interface SyncProgress {
  phase: 'pick' | 'running' | 'done' | 'error';
  allAgents: boolean;
  lastSyncedAt: string | null;
  current: number;
  total: number;
  currentAgent: string;
  currentSession: number;
  currentPhone: string;
  ok: number;
  failed: number;
  log: SyncLogEntry[];
  error?: string;
}

const emptySyncProgress = (allAgents: boolean): SyncProgress => ({
  phase: allAgents ? 'running' : 'pick',
  allAgents,
  lastSyncedAt: null,
  current: 0,
  total: 0,
  currentAgent: '',
  currentSession: 0,
  currentPhone: '',
  ok: 0,
  failed: 0,
  log: [],
});

interface Sim {
  id: string;
  agentId: string;
  phoneNumber: string;
  sessionId: number;
  groupId: string | null;
  next35kAt: string | null;
  next35kReady: boolean;
  next35kAtOverride: string | null;
  next20kAt: string | null;
  next20kReady: boolean;
  next20kAtOverride: string | null;
}

function NextPlayInput({
  ready,
  at,
  overrideAt,
  inputKey,
  onSave,
}: {
  ready: boolean;
  at: string | null;
  overrideAt: string | null;
  inputKey: string;
  onSave: (value: string | null) => void;
}) {
  const showDate = !ready || !!overrideAt;

  return (
    <div className="next-play-edit">
      {ready && !overrideAt && <span className="next-play-ready">Ready</span>}
      <input
        key={inputKey}
        type="datetime-local"
        className="inline-input next-play-input"
        defaultValue={showDate ? toDatetimeLocal(at) : ''}
        title="Edit next play date and time"
        onKeyDown={blurOnEnter}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            if (overrideAt) onSave(null);
            return;
          }
          const iso = fromDatetimeLocal(raw);
          if (!iso) return;
          if (iso !== at || overrideAt !== iso) onSave(iso);
        }}
      />
    </div>
  );
}

export default function AgentsPage() {
  const { loading } = useSession('admin');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sims, setSims] = useState<Sim[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [sortMode, setSortMode] = useState<SimSortMode>('ascending');
  const [agentModal, setAgentModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [simModal, setSimModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', username: '', password: '' });
  const [editForm, setEditForm] = useState({ name: '', username: '', password: '' });
  const [simForm, setSimForm] = useState({ phoneNumber: '', sessionId: '1', groupId: '' });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncAgentId, setSyncAgentId] = useState('');
  const [syncAgentOptions, setSyncAgentOptions] = useState<SyncAgentOption[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(emptySyncProgress(false));
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<SessionUploadResult[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{ updated: number; failed: number; total: number } | null>(null);

  function nextSessionIdForAgent(agentId: string): number {
    const ids = sims.filter((s) => s.agentId === agentId).map((s) => s.sessionId);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  function openSimModal() {
    if (!selectedAgent) return;
    setSimForm({
      phoneNumber: '',
      sessionId: String(nextSessionIdForAgent(selectedAgent)),
      groupId: '',
    });
    setSimModal(true);
  }

  const selectedAgentData = agents.find((a) => a.id === selectedAgent);
  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    sims.filter((s) => s.agentId === selectedAgent && s.groupId).forEach((s) => groups.add(s.groupId!));
    return [...groups].sort();
  }, [sims, selectedAgent]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [agentsData, simsData] = await Promise.all([
        apiFetch<Agent[]>('/api/agents'),
        apiFetch<Sim[]>('/api/sims?both=true'),
      ]);
      setAgents(agentsData);
      setSims(simsData);
      if (!selectedAgent && agentsData.length > 0) setSelectedAgent(agentsData[0].id);
      setDataReady(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (!loading) load().catch(console.error);
  }, [loading, load]);

  useEffect(() => {
    if (selectedAgentData) {
      setEditForm({ name: selectedAgentData.name, username: selectedAgentData.username, password: '' });
    }
  }, [selectedAgentData]);

  const agentSims = sortSims(sims.filter((s) => s.agentId === selectedAgent), sortMode);

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentForm),
    });
    setAgentModal(false);
    setAgentForm({ name: '', username: '', password: '' });
    await load();
  }

  async function updateAgent(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string> = { name: editForm.name, username: editForm.username };
    if (editForm.password) payload.password = editForm.password;
    await apiFetch(`/api/agents/${selectedAgent}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setEditModal(false);
    await load();
  }

  async function createSim(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/api/sims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...simForm,
        agentId: selectedAgent,
        sessionId: Number(simForm.sessionId),
        groupId: simForm.groupId || null,
      }),
    });
    setSimModal(false);
    setSimForm({ phoneNumber: '', sessionId: String(nextSessionIdForAgent(selectedAgent)), groupId: '' });
    await load();
  }

  async function updateSim(id: string, updates: Record<string, unknown>) {
    await apiFetch(`/api/sims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await load();
  }

  async function deleteSim(id: string) {
    if (!confirm('Delete this SIM card?')) return;
    await apiFetch(`/api/sims/${id}`, { method: 'DELETE' });
    await load();
  }

  async function openSyncPicker() {
    setSyncAgentId(selectedAgent);
    setSyncProgress(emptySyncProgress(false));
    setSyncModalOpen(true);

    try {
      const data = await apiFetch<{ agents: SyncAgentOption[] }>('/api/sessions/sync');
      setSyncAgentOptions(data.agents);
      const picked = data.agents.find((a) => a.id === selectedAgent) ?? data.agents[0];
      if (picked) setSyncAgentId(picked.id);
      setSyncProgress((prev) => ({
        ...prev,
        phase: 'pick',
        lastSyncedAt: picked?.lastSessionSyncAt ?? null,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sync data';
      setSyncProgress((prev) => ({ ...prev, phase: 'error', error: msg }));
    }
  }

  async function runSync(allAgents: boolean, agentId?: string) {
    const targetAgentId = allAgents ? undefined : agentId || syncAgentId;
    if (!allAgents && !targetAgentId) {
      setSyncProgress((prev) => ({ ...prev, phase: 'error', error: 'Select an agent to sync.' }));
      return;
    }

    setSyncProgress((prev) => ({ ...prev, phase: 'running', allAgents }));
    setSyncing(true);

    try {
      const params = allAgents ? '' : `?agentId=${encodeURIComponent(targetAgentId!)}`;

      const queue = await apiFetch<{
        items: SyncQueueItem[];
        lastSyncedAt: string | null;
        total: number;
      }>(`/api/sessions/sync${params}`);

      if (queue.total === 0) {
        const agentOpt = syncAgentOptions.find((a) => a.id === targetAgentId);
        setSyncProgress((prev) => ({
          ...prev,
          phase: 'error',
          lastSyncedAt: queue.lastSyncedAt,
          error: allAgents
            ? 'No session tokens found. Run npm run import-sessions first.'
            : `No session tokens for ${agentOpt?.name ?? 'this agent'}. Run npm run import-sessions first.`,
        }));
        return;
      }

      setSyncProgress((prev) => ({
        ...prev,
        phase: 'running',
        lastSyncedAt: queue.lastSyncedAt,
        total: queue.total,
      }));

      let ok = 0;
      let failed = 0;
      const log: SyncLogEntry[] = [];

      for (let i = 0; i < queue.items.length; i++) {
        const item = queue.items[i];

        setSyncProgress((prev) => ({
          ...prev,
          current: i + 1,
          currentAgent: item.agentName,
          currentSession: item.sessionId,
          currentPhone: item.phoneNumber,
          ok,
          failed,
          log,
        }));

        try {
          const result = await apiFetch<{
            response: unknown;
            message?: string;
            httpStatus?: number;
          }>('/api/sessions/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simId: item.simId }),
          });

          const status = formatSyncStatus(result.response, result.httpStatus);
          const message = status.ok ? status.message : (result.message ?? status.message);

          log.push({
            agentName: item.agentName,
            sessionId: item.sessionId,
            phoneNumber: item.phoneNumber,
            ok: status.ok,
            message,
            coins: status.coins,
          });
          if (status.ok) ok++;
          else failed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Request failed';
          log.push({
            agentName: item.agentName,
            sessionId: item.sessionId,
            phoneNumber: item.phoneNumber,
            ok: false,
            message,
            coins: null,
          });
          failed++;
        }

        setSyncProgress((prev) => ({ ...prev, ok, failed, log }));

        const nextItem = queue.items[i + 1];
        if (!nextItem || nextItem.agentId !== item.agentId) {
          try {
            await apiFetch('/api/sessions/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ markAgentComplete: true, agentId: item.agentId }),
            });
          } catch {
            /* last sync timestamp update is best-effort */
          }
        }

        if (i < queue.items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      setSyncProgress((prev) => ({
        ...prev,
        phase: 'done',
        ok,
        failed,
        log,
        lastSyncedAt: new Date().toISOString(),
      }));
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Session sync failed';
      setSyncProgress((prev) => ({
        ...prev,
        phase: 'error',
        error: msg,
      }));
    } finally {
      setSyncing(false);
    }
  }

  async function startSyncAll() {
    setSyncProgress(emptySyncProgress(true));
    setSyncModalOpen(true);
    setSyncAgentOptions([]);
    await runSync(true);
  }

  function closeSyncModal() {
    if (syncing) return;
    setSyncModalOpen(false);
  }

  async function handleSessionUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !selectedAgent) return;

    setUploading(true);
    setUploadModalOpen(true);
    setUploadResults([]);
    setUploadSummary(null);

    const sessions = await Promise.all(
      Array.from(files).map(async (file) => {
        try {
          const text = await file.text();
          const data = JSON.parse(text) as unknown;
          return { filename: file.name, data };
        } catch {
          return { filename: file.name, error: 'Invalid JSON file' };
        }
      })
    );

    try {
      const result = await apiFetch<{
        updated: number;
        failed: number;
        total: number;
        results: SessionUploadResult[];
      }>('/api/sessions/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent, sessions }),
      });
      setUploadResults(result.results);
      setUploadSummary({ updated: result.updated, failed: result.failed, total: result.total });
    } catch (err) {
      setUploadResults([
        {
          filename: '—',
          sessionId: null,
          phoneNumber: null,
          ok: false,
          message: err instanceof Error ? err.message : 'Upload failed',
        },
      ]);
      setUploadSummary({ updated: 0, failed: files.length, total: files.length });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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
    <PhoneRevealProvider>
    <AppShell
      links={adminLinks}
      userLabel="Admin"
      title="Agents"
      subtitle="Manage agent profiles and SIM card inventory"
      actions={
        <>
          <ShowAllNumbersButton />
          <button
            type="button"
            className="btn-secondary"
            disabled={syncing || !selectedAgent || uploading}
            onClick={() => uploadInputRef.current?.click()}
            title="Upload session JSON files for the selected agent"
          >
            {uploading ? 'Uploading…' : 'Upload Sessions'}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={handleSessionUpload}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={syncing}
            onClick={() => openSyncPicker()}
          >
            Sync Sessions
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={syncing}
            onClick={() => startSyncAll()}
            title="Sync every agent with imported session tokens"
          >
            {syncing && syncProgress.allAgents ? 'Syncing…' : 'Sync All'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setAgentModal(true)}>+ Agent</button>
          <button type="button" onClick={openSimModal} disabled={!selectedAgent}>+ SIM</button>
        </>
      }
    >
      <div className="card-stack">
        <div className="card">
          <div className="two-col form-grid">
            <div className="field" style={{ margin: 0 }}>
              <label className="label">Agent</label>
              <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} (@{a.username})</option>
                ))}
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
          {selectedAgentData && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-accent">{selectedAgentData.username}</span>
              <span className="sync-last-meta">
                Last synced: {selectedAgentData.lastSessionSyncAt ? formatDateTime(selectedAgentData.lastSessionSyncAt) : 'Never'}
              </span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditModal(true)}>
                Edit Profile
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>SIM Cards</h3>
            <span className="badge badge-muted">{agentSims.length} cards</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Phone</th>
                  <th>Group</th>
                  <th>Next 35K</th>
                  <th>Next 20K</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!dataReady && dataLoading ? (
                  <tr><td colSpan={6}><LoadingBlock label="Loading SIM cards…" compact /></td></tr>
                ) : agentSims.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No SIM cards</td></tr>
                ) : (
                  agentSims.map((s) => (
                    <tr key={s.id} className={groupColorClass(s.groupId)}>
                      <td>
                        <input
                          type="number"
                          className="inline-input"
                          style={{ width: '70px' }}
                          defaultValue={s.sessionId}
                          onKeyDown={blurOnEnter}
                          onBlur={(e) =>
                            Number(e.target.value) !== s.sessionId &&
                            updateSim(s.id, { sessionId: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <PhoneReveal
                          phone={s.phoneNumber}
                          editable
                          onSave={(val) => updateSim(s.id, { phoneNumber: val })}
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          style={{ width: '80px' }}
                          defaultValue={s.groupId || ''}
                          placeholder="—"
                          list={`groups-${selectedAgent}`}
                          onKeyDown={blurOnEnter}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (val !== (s.groupId || null)) updateSim(s.id, { groupId: val });
                          }}
                        />
                        <datalist id={`groups-${selectedAgent}`}>
                          {existingGroups.map((g) => <option key={g} value={g} />)}
                        </datalist>
                        {s.groupId && <span className="badge-group">{s.groupId}</span>}
                      </td>
                      <td className="next-play-cell next-play-35k">
                        <NextPlayInput
                          ready={s.next35kReady}
                          at={s.next35kAt}
                          overrideAt={s.next35kAtOverride}
                          inputKey={`${s.id}-35k-${s.next35kAt}-${s.next35kAtOverride}`}
                          onSave={(value) => updateSim(s.id, { next35kAt: value })}
                        />
                      </td>
                      <td className="next-play-cell next-play-20k">
                        <NextPlayInput
                          ready={s.next20kReady}
                          at={s.next20kAt}
                          overrideAt={s.next20kAtOverride}
                          inputKey={`${s.id}-20k-${s.next20kAt}-${s.next20kAtOverride}`}
                          onSave={(value) => updateSim(s.id, { next20kAt: value })}
                        />
                      </td>
                      <td>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteSim(s.id)}>×</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={agentModal} title="New Agent" onClose={() => setAgentModal(false)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setAgentModal(false)}>Cancel</button><button type="submit" form="add-agent">Create</button></>}>
        <form id="add-agent" className="form-grid" onSubmit={createAgent}>
          <div className="field"><label className="label">Name</label><input value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} required /></div>
          <div className="field"><label className="label">Username</label><input value={agentForm.username} onChange={(e) => setAgentForm({ ...agentForm, username: e.target.value })} required /></div>
          <div className="field"><label className="label">Password</label><input type="password" value={agentForm.password} onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })} required /></div>
        </form>
      </Modal>

      <Modal open={editModal} title={`Edit — ${selectedAgentData?.name}`} onClose={() => setEditModal(false)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setEditModal(false)}>Cancel</button><button type="submit" form="edit-agent">Save</button></>}>
        <form id="edit-agent" className="form-grid" onSubmit={updateAgent}>
          <div className="field"><label className="label">Name</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></div>
          <div className="field"><label className="label">Username</label><input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required /></div>
          <div className="field"><label className="label">New Password (leave blank to keep)</label><input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} /></div>
        </form>
      </Modal>

      <Modal open={simModal} title="Add SIM Card" onClose={() => setSimModal(false)}
        footer={<><button type="button" className="btn-secondary" onClick={() => setSimModal(false)}>Cancel</button><button type="submit" form="add-sim">Add</button></>}>
        <form id="add-sim" className="form-grid" onSubmit={createSim}>
          <div className="field">
            <label className="label">Session ID (auto)</label>
            <input type="number" value={simForm.sessionId} readOnly />
          </div>
          <div className="field"><label className="label">Phone Number</label><input value={simForm.phoneNumber} onChange={(e) => setSimForm({ ...simForm, phoneNumber: e.target.value })} required /></div>
          <div className="field">
            <label className="label">Group ID (optional — use same ID to group cards)</label>
            <input value={simForm.groupId} onChange={(e) => setSimForm({ ...simForm, groupId: e.target.value })} placeholder="e.g. A, B, 1" list={`groups-${selectedAgent}`} />
          </div>
        </form>
      </Modal>

      <Modal
        open={syncModalOpen}
        fixed
        closeDisabled={syncing}
        title={
          syncProgress.phase === 'pick'
            ? 'Sync sessions'
            : syncProgress.phase === 'done'
              ? 'Sync complete'
              : syncProgress.phase === 'error'
                ? 'Sync failed'
                : syncProgress.allAgents
                  ? 'Syncing all sessions'
                  : `Syncing — ${syncAgentOptions.find((a) => a.id === syncAgentId)?.name ?? 'Agent'}`
        }
        onClose={closeSyncModal}
        footer={
          syncProgress.phase === 'pick' ? (
            <>
              <button type="button" className="btn-secondary" onClick={closeSyncModal}>Cancel</button>
              <button
                type="button"
                disabled={!syncAgentId || syncing}
                onClick={() => runSync(false, syncAgentId)}
              >
                Start sync
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={closeSyncModal} disabled={syncing}>
              {syncProgress.phase === 'running' ? 'Running…' : 'Close'}
            </button>
          )
        }
      >
        <div className="sync-modal">
          {syncProgress.phase === 'pick' && (
            <div className="field">
              <label className="label">Agent to sync</label>
              <select
                value={syncAgentId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSyncAgentId(id);
                  const agent = syncAgentOptions.find((a) => a.id === id);
                  setSyncProgress((prev) => ({
                    ...prev,
                    lastSyncedAt: agent?.lastSessionSyncAt ?? null,
                  }));
                }}
              >
                <option value="">Select agent…</option>
                {syncAgentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (@{a.username}) — {a.tokenCount} token{a.tokenCount === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="sync-last-meta">
            Last synced:{' '}
            {(() => {
              const pickAgent = syncAgentOptions.find((a) => a.id === syncAgentId);
              const iso =
                syncProgress.phase === 'done'
                  ? syncProgress.lastSyncedAt
                  : syncProgress.lastSyncedAt ?? pickAgent?.lastSessionSyncAt ?? selectedAgentData?.lastSessionSyncAt;
              return iso ? formatDateTime(iso) : 'Never';
            })()}
          </p>

          {syncProgress.phase === 'error' && (
            <p className="sync-error">{syncProgress.error}</p>
          )}

          {(syncProgress.phase === 'running' || syncProgress.phase === 'done') && syncProgress.total > 0 && (
            <>
              <div className="sync-progress-bar" aria-hidden="true">
                <div
                  className="sync-progress-fill"
                  style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                />
              </div>
              <p className="sync-progress-count">
                {syncProgress.current} / {syncProgress.total}
                {syncProgress.phase === 'done' && (
                  <span className="sync-summary">
                    {' '}· {syncProgress.ok} ok, {syncProgress.failed} failed
                  </span>
                )}
              </p>
            </>
          )}

          {syncProgress.phase === 'running' && syncProgress.currentAgent && (
            <div className="sync-current">
              <div className="sync-current-label">Currently syncing</div>
              <div className="sync-current-agent">{syncProgress.currentAgent}</div>
              <div className="sync-current-session">
                SIM <strong>{syncProgress.currentSession}</strong>
                {syncProgress.currentPhone && (
                  <span> · {syncProgress.currentPhone}</span>
                )}
              </div>
            </div>
          )}

          {syncProgress.log.length > 0 && (
            <div className="sync-log">
              {syncProgress.log.map((entry, i) => (
                <div key={`${entry.agentName}-${entry.sessionId}-${i}`} className={`sync-log-row${entry.ok ? '' : ' sync-log-fail'}`}>
                  <span className="sync-log-main">
                    {syncProgress.allAgents && <span>{entry.agentName} · </span>}
                    SIM {entry.sessionId} · {entry.phoneNumber}
                  </span>
                  <span className="sync-log-status">
                    {entry.ok
                      ? entry.coins !== null
                        ? `${entry.coins} coin${entry.coins === 1 ? '' : 's'}`
                        : 'OK'
                      : entry.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={uploadModalOpen}
        fixed
        title={
          uploading
            ? `Uploading sessions — ${selectedAgentData?.name ?? 'Agent'}`
            : `Upload complete — ${selectedAgentData?.name ?? 'Agent'}`
        }
        onClose={() => !uploading && setUploadModalOpen(false)}
        closeDisabled={uploading}
        footer={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setUploadModalOpen(false)}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Close'}
          </button>
        }
      >
        <div className="sync-modal">
          {uploading ? (
            <LoadingBlock label="Saving session tokens…" compact />
          ) : (
            <>
              {uploadSummary && (
                <p className="sync-progress-count">
                  {uploadSummary.updated} saved, {uploadSummary.failed} failed (of {uploadSummary.total})
                </p>
              )}
              <p className="sync-last-meta">
                Files must be named like <code>agent (1).json</code> and contain SRBNtoken + SRBNphone.
              </p>
              {uploadResults.length > 0 && (
                <div className="sync-log">
                  {uploadResults.map((entry, i) => (
                    <div
                      key={`${entry.filename}-${i}`}
                      className={`sync-log-row${entry.ok ? '' : ' sync-log-fail'}`}
                    >
                      <span className="sync-log-main">
                        {entry.sessionId !== null ? `SIM ${entry.sessionId}` : entry.filename}
                        {entry.phoneNumber ? ` · ${entry.phoneNumber}` : ''}
                      </span>
                      <span className="sync-log-status">{entry.ok ? 'Saved' : entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </AppShell>
    </PhoneRevealProvider>
  );
}
