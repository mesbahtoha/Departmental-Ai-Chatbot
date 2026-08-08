/**
 * Skeleton loading primitives - shimmer placeholders shown while
 * data is being fetched so the UI never looks blank.
 */

export function SkeletonBox({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: width ?? '100%', height: height ?? 14, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonCircle({ size = 32 }: { size?: number }) {
  return <SkeletonBox width={size} height={size} radius={999} />;
}

/** Skeleton row for list items (used in table/card loading states). */
export function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <SkeletonCircle size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <SkeletonBox width="38%" height={13} style={{ marginBottom: 8 }} />
        <SkeletonBox width="70%" height={11} />
      </div>
    </div>
  );
}

/** Skeleton table with a header bar and N body rows. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <SkeletonBox width={120} height={10} />
        <SkeletonBox width={90} height={10} />
        <SkeletonBox width={70} height={10} />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}

/** Skeleton for the chat conversation screen. */
export function ChatSkeleton() {
  return (
    <div style={{ padding: '20px 20px 0', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <SkeletonCircle size={56} />
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SkeletonBox width={200} height={16} style={{ marginBottom: 10 }} />
          <SkeletonBox width={260} height={12} />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="message-row" style={{ display: 'flex', gap: 12 }}>
          <SkeletonCircle size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <SkeletonBox width={90} height={12} style={{ marginBottom: 10 }} />
            <SkeletonBox width="100%" height={12} style={{ marginBottom: 8 }} />
            <SkeletonBox width="80%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for stat-card grids (dashboard etc.). */
export function StatGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <SkeletonCircle size={34} />
            <SkeletonBox width={110} height={12} />
          </div>
          <SkeletonBox width={80} height={22} />
        </div>
      ))}
    </div>
  );
}
