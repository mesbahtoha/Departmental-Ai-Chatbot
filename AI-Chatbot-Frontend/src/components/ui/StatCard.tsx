import type { ReactNode } from 'react';
import { formatNumber } from '@/lib/format';

export function StatCard({
  label,
  value,
  icon,
  accent = 'primary',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  hint?: string;
}) {
  const colors: Record<string, string> = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    danger: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
  };

  return (
    <div className="card card-pad flex items-center justify-between" style={{ gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div className="text-sm text-muted font-medium">{label}</div>
        <div className="text-xl font-bold" style={{ marginTop: 4 }}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
        {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
      </div>
      {icon && (
        <div
          className="flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: colors[accent] + '22',
            color: colors[accent],
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
