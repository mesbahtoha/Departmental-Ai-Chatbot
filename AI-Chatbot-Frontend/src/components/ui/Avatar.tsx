import { clsx } from 'clsx';
import { initials } from '@/lib/format';

export function Avatar({
  name,
  size = 'md',
  src,
  className,
}: {
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  src?: string | null;
  className?: string;
}) {
  return src ? (
    <img
      src={src}
      alt={name || 'avatar'}
      className={clsx('avatar', size === 'sm' && 'avatar-sm', size === 'lg' && 'avatar-lg', className)}
      style={{ objectFit: 'cover' }}
    />
  ) : (
    <span className={clsx('avatar', size === 'sm' && 'avatar-sm', size === 'lg' && 'avatar-lg', className)}>
      {initials(name)}
    </span>
  );
}
