import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'success' | 'danger' | 'warning' | 'muted' | 'info';

export function Badge({
  variant = 'muted',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return <span className={clsx('badge', `badge-${variant}`, className)}>{children}</span>;
}
