import { clsx } from 'clsx';

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx('spin inline-flex', className)}
      style={{ width: size, height: size, fontSize: size }}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '50vh', gap: 12 }}>
      <Spinner size={32} />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
