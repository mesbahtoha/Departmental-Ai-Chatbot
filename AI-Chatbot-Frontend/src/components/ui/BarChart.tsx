import { useEffect, useRef, useState } from 'react';

/** Tiny client-side bar chart (no external chart lib needed). */
export function BarChart({
  data,
  color = 'var(--color-primary)',
  height = 160,
  formatValue,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!data.length) {
    return <div className="text-sm text-muted text-center" style={{ padding: 24 }}>No data yet</div>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = Math.max(4, Math.min(36, width / data.length - 6));

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div className="flex items-end justify-between" style={{ gap: 4, height, width }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center" style={{ width: barWidth + 6 }}>
            <span
              className="text-xs"
              style={{ marginBottom: 4, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatValue ? formatValue(d.value) : d.value}
            </span>
            <div
              style={{
                width: barWidth,
                height: Math.max(2, (d.value / max) * (height - 34)),
                background: color,
                borderRadius: '4px 4px 0 0',
                opacity: 0.85,
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1" style={{ gap: 4 }}>
        {data.map((d, i) => (
          <span key={i} className="text-xs text-muted ellipsis" style={{ width: barWidth + 6, textAlign: 'center' }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
