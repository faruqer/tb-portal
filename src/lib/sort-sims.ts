import { NEXT_PLAY_DELAY_DAYS, addDaysStr, todayStr } from '@/lib/calculations';

export type SimSortMode = 'ascending' | 'grouped' | 'by-agent' | 'by-agent-group';

export interface SortableSim {
  sessionId: number;
  phoneNumber: string;
  groupId?: string | null;
  agentName?: string;
}

function normGroup(groupId: string | null | undefined): string {
  return (groupId || '').trim().toLowerCase();
}

export function sortSims<T extends SortableSim>(sims: T[], mode: SimSortMode): T[] {
  const copy = [...sims];

  if (mode === 'ascending') {
    return copy.sort((a, b) => a.sessionId - b.sessionId || a.phoneNumber.localeCompare(b.phoneNumber));
  }

  if (mode === 'by-agent' || mode === 'by-agent-group') {
    return copy.sort((a, b) => {
      const na = (a.agentName || '').localeCompare(b.agentName || '');
      if (na !== 0) return na;
      if (mode === 'by-agent-group') {
        const ga = normGroup(a.groupId) || '\uffff';
        const gb = normGroup(b.groupId) || '\uffff';
        if (ga !== gb) return ga.localeCompare(gb);
      }
      if (a.sessionId !== b.sessionId) return a.sessionId - b.sessionId;
      return a.phoneNumber.localeCompare(b.phoneNumber);
    });
  }

  return copy.sort((a, b) => {
    const ga = normGroup(a.groupId) || '\uffff';
    const gb = normGroup(b.groupId) || '\uffff';
    if (ga !== gb) return ga.localeCompare(gb);
    if (a.sessionId !== b.sessionId) return a.sessionId - b.sessionId;
    return a.phoneNumber.localeCompare(b.phoneNumber);
  });
}

const GROUP_COLORS = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e', 'group-f'];

export function groupColorClass(groupId: string | null | undefined): string {
  const g = normGroup(groupId);
  if (!g) return '';
  let hash = 0;
  for (let i = 0; i < g.length; i++) hash = (hash + g.charCodeAt(i) * (i + 1)) % GROUP_COLORS.length;
  return GROUP_COLORS[hash];
}

export { NEXT_PLAY_DELAY_DAYS };

export interface SimComputed {
  lastPlayedDate: string | null;
  nextPlayingDate: string | null;
  isAvailable: boolean;
}

export function computeSimDatesFromMap(
  agentId: string,
  sessionId: number,
  playMap: Map<string, string>
): SimComputed {
  const key = `${agentId}:${sessionId}`;
  const lastPlayedDate = playMap.get(key) ?? null;
  const nextPlayingDate = lastPlayedDate ? addDaysStr(lastPlayedDate, NEXT_PLAY_DELAY_DAYS) : null;
  // Available exactly after 7 full days (on the 7th day after play date)
  const isAvailable = !lastPlayedDate || todayStr() >= (nextPlayingDate ?? '');

  return { lastPlayedDate, nextPlayingDate, isAvailable };
}
