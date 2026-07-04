'use client';

import { money } from '@/lib/calculations';
import type { GameTotals } from '@/lib/types';

interface DayMetricsProps {
  data: GameTotals;
  compact?: boolean;
}

export function DayMetrics({ data, compact }: DayMetricsProps) {
  if (compact) {
    return (
      <div className="day-metrics compact">
        <div className="dm-row"><span className="dm-label">Won</span><span>{money(data.wonProfit)}</span></div>
        <div className="dm-row"><span className="dm-label">Net</span><span>{money(data.netProfit)}</span></div>
        <div className="dm-row"><span className="dm-label">Expected</span><span>{money(data.expectedToReceive)}</span></div>
        <div className="dm-row"><span className="dm-label">Received</span><span>{money(data.received)}</span></div>
      </div>
    );
  }

  return (
    <div className="day-metrics">
      <div className="dm-row"><span className="dm-label">Won</span><span>{money(data.wonProfit)}</span></div>
      <div className="dm-row"><span className="dm-label">Net</span><span>{money(data.netProfit)}</span></div>
      <div className="dm-row"><span className="dm-label">Expected</span><span>{money(data.expectedToReceive)}</span></div>
      <div className="dm-row"><span className="dm-label">Received</span><span>{money(data.received)}</span></div>
    </div>
  );
}
