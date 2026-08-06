import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '48px 24px', gap: 8 }}>
      {icon && <div style={{ fontSize: 40, opacity: 0.6 }}>{icon}</div>}
      <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
      {description && <p className="text-muted text-sm" style={{ margin: 0, maxWidth: 420 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
