import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const [value, setValue] = useState(String(page));
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    setValue(String(page));
  }, [page]);

  if (totalPages <= 1) return null;

  const go = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next));
    if (clamped !== page) onChange(clamped);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(value, 10);
    go(Number.isNaN(parsed) ? 1 : parsed);
  };

  return (
    <div className="flex items-center justify-between mt-4" style={{ gap: 12 }}>
      <span className="text-sm text-muted">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex items-center gap-2">
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          ← Prev
        </button>
        <form onSubmit={submit} className="flex items-center gap-1">
          <input
            className="input"
            style={{ width: 60, padding: '6px 8px', textAlign: 'center' }}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
            aria-label="Go to page"
          />
        </form>
        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => go(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

export function cls(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}
