import { useEffect, useState } from 'react';
import { FaChartLine } from 'react-icons/fa';
import { apiGet } from '@/lib/api';
import { BarChart } from '@/components/ui/BarChart';
import { StatCard } from '@/components/ui/StatCard';
import { StatGridSkeleton } from '@/components/ui/Skeleton';
import { Select } from '@/components/ui/Form';
import { formatTokens } from '@/lib/format';

interface AnalyticsData {
  range: { from: string; to: string };
  summary: { totalTokens: number; requests: number; averageTokens: number };
  series: { date: string; totalTokens: number; requests: number }[];
  topModels: { model: string; totalTokens: number; requests: number }[];
  today: number;
}

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [groupBy, setGroupBy] = useState('day');

  useEffect(() => {
    setData(null);
    apiGet<{ analytics: AnalyticsData }>(`/api/v1/admin/analytics/usage?groupBy=${groupBy}`)
      .then((payload) => setData(payload.analytics))
      .catch(() => setData(null));
  }, [groupBy]);

  if (!data) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-title">
            <h2>Analytics</h2>
            <span className="text-sm text-muted">Loading usage data…</span>
          </div>
        </div>
        <StatGridSkeleton cards={3} />
      </div>
    );
  }

  const series = data.series.map((row) => ({
    label: new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: row.totalTokens,
  }));

  const totalSeries = data.series.reduce((acc, row) => acc + row.totalTokens, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h2>Analytics</h2>
          <span className="text-sm text-muted">
            {new Date(data.range.from).toLocaleDateString()} → {new Date(data.range.to).toLocaleDateString()}
          </span>
        </div>
        <div className="page-header-actions">
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ width: 140 }}>
            <option value="day">By day</option>
            <option value="month">By month</option>
          </Select>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard label="Tokens in range" value={formatTokens(totalSeries)} icon={<FaChartLine />} />
        <StatCard label="Requests" value={data.summary.requests} hint={`${data.summary.averageTokens ?? 0} avg tokens/request`} />
        <StatCard label="Tokens today" value={formatTokens(data.today)} accent="success" />
      </div>

      <div className="card mt-6">
        <div className="card-header">
          <span className="font-semibold">Token usage over time</span>
        </div>
        <div className="card-body">
          <BarChart data={series} formatValue={formatTokens} height={200} />
        </div>
      </div>

      {data.topModels.length > 0 && (
        <div className="card mt-6">
          <div className="card-header">
            <span className="font-semibold">Top models</span>
          </div>
          <div className="card-body">
            {data.topModels.map((model) => {
              const pct = totalSeries ? Math.round((model.totalTokens / totalSeries) * 100) : 0;
              return (
                <div key={model.model} style={{ marginBottom: 14 }}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{model.model}</span>
                    <span className="text-muted">
                      {formatTokens(model.totalTokens)} tokens · {model.requests} requests · {pct}%
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-surface-2)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
