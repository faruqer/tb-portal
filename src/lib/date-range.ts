type DateRangeFilter = {
  date: string | { $gte?: string; $lte?: string };
};

export function buildDateRangeMongo(
  from: string | null | undefined,
  to: string | null | undefined,
  singleDate?: string | null
): DateRangeFilter | undefined {
  if (singleDate) return { date: singleDate };

  const f = from?.trim() || '';
  const t = to?.trim() || '';
  if (f && t) {
    const [lo, hi] = f <= t ? [f, t] : [t, f];
    return { date: { $gte: lo, $lte: hi } };
  }
  if (f) return { date: { $gte: f } };
  if (t) return { date: { $lte: t } };
  return undefined;
}

export function appendDateRangeParams(params: URLSearchParams, from: string, to: string) {
  if (from) params.set('from', from);
  if (to) params.set('to', to);
}

export function dateRangeQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  appendDateRangeParams(params, from, to);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
}

export function dateRangeLabel(from: string, to: string, allLabel = 'All time'): string {
  if (from && to) return from === to ? from : `${from} → ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return allLabel;
}

export function hasDateRange(from: string, to: string): boolean {
  return Boolean(from || to);
}
