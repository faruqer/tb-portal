export function roundAmount(value: number): number {
  return Math.round(Number(value) || 0);
}

export function calcNetProfit(wonProfit: number): number {
  return (Number(wonProfit) || 0) * 0.75;
}

export function calcExpectedToReceive(netProfit: number): number {
  return (Number(netProfit) || 0) * 0.5;
}

export function parseSessionId(value: string | number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

/** Whole numbers only — no cents */
export function money(value: number): string {
  return roundAmount(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

/** Exact amount for display — keeps decimals (e.g. 750.75). */
export function moneyExact(value: number): string {
  const n = Number(value) || 0;
  return String(Math.round(n * 100) / 100);
}

/** Integer only — for clipboard copy. */
export function copyAmount(value: number): string {
  return String(Math.trunc(Number(value) || 0));
}

/** Plain integer string — no commas, no decimal part. */
export function moneyPlain(value: number): string {
  return String(Math.trunc(Number(value) || 0));
}

/** For number inputs — preserves decimals when present. */
export function amountInput(value: number): string {
  return moneyExact(value);
}

export const NEXT_PLAY_DELAY_DAYS = 7;

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export function addDaysToDate(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocalStr(): string {
  return localDateStr(new Date());
}

/** Monday of the week containing `d`, as YYYY-MM-DD in local time. */
export function getWeekStartStr(d = new Date()): string {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return localDateStr(copy);
}

/** Not available yet, but cooldown ends later today (local time). */
export function isCooldownDueLaterToday(sim: {
  isAvailable: boolean;
  nextPlayingAt: string | null;
}): boolean {
  if (sim.isAvailable || !sim.nextPlayingAt) return false;
  const next = new Date(sim.nextPlayingAt);
  if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) return false;
  return localDateStr(next) === todayLocalStr();
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function normalizeGroupId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().toLowerCase();
}
