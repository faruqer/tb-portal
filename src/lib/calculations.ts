export function roundAmount(value: number): number {
  return Math.round(Number(value) || 0);
}

export function calcNetProfit(wonProfit: number): number {
  return roundAmount(wonProfit * 0.75);
}

export function calcExpectedToReceive(netProfit: number): number {
  return roundAmount(netProfit * 0.5);
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

/** For number inputs — no decimal display */
export function amountInput(value: number): string {
  return String(roundAmount(value));
}

export const NEXT_PLAY_DELAY_DAYS = 7;

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeGroupId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().toLowerCase();
}
