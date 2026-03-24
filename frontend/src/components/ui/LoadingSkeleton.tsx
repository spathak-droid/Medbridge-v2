interface SkeletonProps {
  variant?: 'text' | 'card' | 'chat'
  count?: number
}

function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      className="h-4 rounded-lg bg-neutral-200 animate-shimmer"
      style={{
        width,
        backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <SkeletonLine width="40%" />
      <SkeletonLine width="80%" />
      <SkeletonLine width="60%" />
    </div>
  )
}

function SkeletonChat() {
  return (
    <div className="space-y-4 p-4">
      {/* Coach message */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-neutral-200 animate-shimmer flex-shrink-0" />
        <div className="space-y-2 flex-1 max-w-[70%]">
          <SkeletonLine width="90%" />
          <SkeletonLine width="70%" />
        </div>
      </div>
      {/* Patient message */}
      <div className="flex justify-end">
        <div className="space-y-2 max-w-[60%]">
          <SkeletonLine width="80%" />
        </div>
      </div>
      {/* Coach message */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-neutral-200 animate-shimmer flex-shrink-0" />
        <div className="space-y-2 flex-1 max-w-[70%]">
          <SkeletonLine width="85%" />
          <SkeletonLine width="55%" />
          <SkeletonLine width="70%" />
        </div>
      </div>
    </div>
  )
}

export function LoadingSkeleton({ variant = 'text', count = 1 }: SkeletonProps) {
  if (variant === 'chat') return <SkeletonChat />

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          {variant === 'card' ? <SkeletonCard /> : (
            <div className="space-y-2">
              <SkeletonLine width="90%" />
              <SkeletonLine width="70%" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
