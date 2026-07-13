'use client';

import type { GameFilter } from '@/lib/game-filter';

interface ReportGameFilterProps {
  value: GameFilter;
  onChange: (key: GameFilter) => void;
}

export function ReportGameFilter({ value, onChange }: ReportGameFilterProps) {
  return (
    <div className="field report-game-filter">
      <label className="label" htmlFor="report-game-filter">
        Game filter
      </label>
      <select
        id="report-game-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as GameFilter)}
        style={{ width: 'auto', minWidth: '10rem' }}
      >
        <option value="all">All games (merged)</option>
        <option value="35k">35K only</option>
        <option value="20k">20K only</option>
      </select>
    </div>
  );
}
