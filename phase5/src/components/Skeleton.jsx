/** Animated skeleton loader components */

const shimmer = {
  background: 'linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  borderRadius: '4px',
};

export function SkeletonLine({ width = '100%', height = '12px', style = {} }) {
  return <div style={{ ...shimmer, width, height, ...style }} />;
}

export function SkeletonCard({ style = {} }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '6px',
      padding: '14px 16px', background: 'var(--bg2)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      ...style,
    }}>
      <SkeletonLine width="60%" height="14px" />
      <SkeletonLine width="40%" height="11px" />
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <SkeletonLine width="52px" height="18px" style={{ borderRadius: '10px' }} />
        <SkeletonLine width="52px" height="18px" style={{ borderRadius: '10px' }} />
      </div>
    </div>
  );
}

export function SkeletonJobList({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonAnalyser() {
  return (
    <div style={{ padding: '40px', maxWidth: '860px' }}>
      <SkeletonLine width="200px" height="32px" style={{ marginBottom: '24px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '280px' }}>
          <SkeletonLine width="240px" height="240px" style={{ borderRadius: '50%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLine key={i} width={`${60 + Math.random() * 40}%`} height="44px" style={{ borderRadius: '6px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
