'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { adminLinks } from '@/components/NavBar';
import { Modal } from '@/components/Modal';
import { useSession, apiFetch } from '@/lib/hooks';
import { formatDateTime } from '@/lib/calculations';
import { sortSims, groupColorClass } from '@/lib/sort-sims';
import type { SimSortMode } from '@/lib/types';

interface Agent {
  id: string;
  name: string;
  username: string;
}

interface Sim {
  id: string;
  agentId: string;
  phoneNumber: string;
  sessionId: number;
  groupId: string | null;
  lastPlayedDate: string | null;
  nextPlayingDate: string | null;
  nextPlayingAt: string | null;
  isAvailable: boolean;
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
    const [agentsData, simsData] = await Promise.all([
      apiFetch<Agent[]>('/api/agents'),
      apiFetch<Sim[]>('/api/sims'),
    ]);
    setAgents(agentsData);
    setSims(simsData);
    if (!selectedAgent && agentsData.length > 0) setSelectedAgent(agentsData[0].id);
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

  async function updateSim(id: string, updates: Partial<Sim>) {
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

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <AppShell
      links={adminLinks}
      userLabel="Admin"
      title="Agents"
      subtitle="Manage agent profiles and SIM card inventory"
      actions={
        <>
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
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge badge-accent">{selectedAgentData.username}</span>
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
                  <th>Last Played</th>
                  <th>Next Play</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agentSims.length === 0 ? (
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
                          onBlur={(e) =>
                            Number(e.target.value) !== s.sessionId &&
                            updateSim(s.id, { sessionId: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          defaultValue={s.phoneNumber}
                          onBlur={(e) =>
                            e.target.value !== s.phoneNumber && updateSim(s.id, { phoneNumber: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="inline-input"
                          style={{ width: '80px' }}
                          defaultValue={s.groupId || ''}
                          placeholder="—"
                          list={`groups-${selectedAgent}`}
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
                      <td>{s.lastPlayedDate || '—'}</td>
                      <td>
                        {s.isAvailable ? (
                          <span className="badge badge-success">Ready</span>
                        ) : s.nextPlayingAt ? (
                          <span className="badge badge-muted">{formatDateTime(s.nextPlayingAt)}</span>
                        ) : (
                          <span className="badge badge-muted">—</span>
                        )}
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
    </AppShell>
  );
}
