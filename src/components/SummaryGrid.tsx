'use client';

import { money } from '@/lib/calculations';
import type { GameTotals } from '@/lib/types';

interface SummaryGridProps {
  totals: GameTotals;
  label?: string;
}

export function SummaryGrid({ totals, label }: SummaryGridProps) {
  return (
    <div>
      {label && <p className="label" style={{ marginBottom: '0.65rem' }}>{label}</p>}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Won Profit</div>
          <div className="stat-value">{money(totals.wonProfit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net (75%)</div>
          <div className="stat-value">{money(totals.netProfit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expected (50%)</div>
          <div className="stat-value">{money(totals.expectedToReceive)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Verified Received</div>
          <div className="stat-value">{money(totals.received)}</div>
        </div>
      </div>
    </div>
  );
}
