const DEFAULT_DELAY_MS = 300;

export function extractSessionIndex(filename: string): number | null {
  const match = filename.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isKeepAliveSuccess(response: unknown): boolean {
  const resp = response as { code?: string | number; error?: string } | null;
  if (!resp || resp.error) return false;
  return String(resp.code) === '0';
}

export function keepAliveMessage(response: unknown, httpStatus?: number): string {
  const resp = response as { code?: string | number; msg?: string; error?: string; raw?: string } | null;
  if (!resp) return httpStatus ? `HTTP ${httpStatus}, empty body` : 'No response';
  if (resp.error) return String(resp.error);
  if (resp.raw) return resp.raw;
  if (resp.msg) return resp.msg;
  return `HTTP ${httpStatus ?? '?'}, code ${resp.code ?? '?'}`;
}

export function parseKeepAliveCoins(response: unknown): number | null {
  const resp = response as { data?: { coins?: number | string } } | null;
  const coins = resp?.data?.coins;
  if (coins === undefined || coins === null || coins === '') return null;
  const n = Number(coins);
  return Number.isFinite(n) ? n : null;
}

export function formatSyncStatus(response: unknown, httpStatus?: number): { ok: boolean; message: string; coins: number | null } {
  const ok = isKeepAliveSuccess(response);
  return {
    ok,
    message: keepAliveMessage(response, httpStatus),
    coins: ok ? parseKeepAliveCoins(response) : null,
  };
}

export interface SessionSyncItem {
  simId: string;
  agentId: string;
  agentName: string;
  sessionId: number;
  phoneNumber: string;
  response: unknown;
  httpStatus?: number;
}

export function summarizeSyncResults(results: SessionSyncItem[]) {
  const ok = results.filter((r) => isKeepAliveSuccess(r.response)).length;
  const failed = results.length - ok;
  return { total: results.length, ok, failed };
}

export async function syncSessionTokens(
  items: {
    simId: string;
    agentId: string;
    agentName: string;
    sessionId: number;
    phoneNumber: string;
    sessionToken: string;
  }[],
  delayMs = DEFAULT_DELAY_MS
): Promise<SessionSyncItem[]> {
  const { sendSessionKeepAlive } = await import('@/lib/session-sync-server');
  const results: SessionSyncItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { response, httpStatus } = await sendSessionKeepAlive(item.sessionToken);
    results.push({
      simId: item.simId,
      agentId: item.agentId,
      agentName: item.agentName,
      sessionId: item.sessionId,
      phoneNumber: item.phoneNumber,
      response,
      httpStatus,
    });
    if (i < items.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  return results;
}
