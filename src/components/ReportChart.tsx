'use client';

import { money } from '@/lib/calculations';

export interface ChartData {
  period: 'day' | 'week' | 'month';
  labels: string[];
  series: {
    won: number[];
    net: number[];
    expected: number[];
    received: number[];
  };
}

interface ReportChartProps {
  data: ChartData;
  activeMetrics: Set<MetricKey>;
}

type MetricKey = 'won' | 'net' | 'expected' | 'received';

const METRIC_META: Record<MetricKey, { label: string; color: string; className: string }> = {
  won: { label: 'Won', color: '#ffffff', className: 'bar-won' },
  net: { label: 'Net', color: '#d4d4d4', className: 'bar-net' },
  expected: { label: 'Expected', color: '#a3a3a3', className: 'bar-expected' },
  received: { label: 'Received', color: '#737373', className: 'bar-received' },
};

export function ReportChart({ data, activeMetrics }: ReportChartProps) {
  const allValues: number[] = [];
  for (const key of activeMetrics) {
    allValues.push(...data.series[key]);
  }
  const maxVal = Math.max(...allValues, 1);

  return (
    <div className="report-chart">
      <div className="chart-legend">
        {(Object.keys(METRIC_META) as MetricKey[]).map((key) => (
          <span key={key} className={`chart-legend-item ${activeMetrics.has(key) ? 'active' : 'inactive'}`}>
            <span className="legend-dot" style={{ background: METRIC_META[key].color }} />
            {METRIC_META[key].label}
          </span>
        ))}
      </div>
      <div className="chart-scroll">
        <div className="chart-bars">
          {data.labels.map((label, i) => (
            <div key={`${label}-${i}`} className="chart-group">
              <div className="chart-bar-stack">
                {(Object.keys(METRIC_META) as MetricKey[]).map((key) => {
                  if (!activeMetrics.has(key)) return null;
                  const val = data.series[key][i] || 0;
                  const height = Math.max((val / maxVal) * 100, val > 0 ? 4 : 0);
                  return (
                    <div key={key} className="chart-bar-wrap">
                      {val > 0 && (
                        <span className="chart-bar-value" style={{ color: METRIC_META[key].color }}>
                          {money(val)}
                        </span>
                      )}
                      <div
                        className={`chart-bar ${METRIC_META[key].className}`}
                        style={{ height: `${height}%` }}
                        title={`${METRIC_META[key].label}: ${money(val)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="chart-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { MetricKey };
