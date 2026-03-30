function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className ?? ""}`}
    />
  );
}

export function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Pulse className="h-12 w-12 rounded-lg" />
        <div className="space-y-2">
          <Pulse className="h-6 w-32" />
          <Pulse className="h-4 w-48" />
        </div>
      </div>
      <Pulse className="h-9 w-40" />
      <div className="grid grid-cols-4 gap-4">
        <Pulse className="h-4 w-full" />
        <Pulse className="h-4 w-full" />
        <Pulse className="h-4 w-full" />
        <Pulse className="h-4 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Pulse className="h-8 w-full" />
        <Pulse className="h-8 w-full" />
      </div>
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="space-y-6">
      <Pulse className="h-6 w-28" />
      {[1, 2, 3].map((g) => (
        <div key={g} className="space-y-2">
          <Pulse className="h-4 w-20" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((m) => (
              <Pulse key={m} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-3">
      <Pulse className="h-6 w-36" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Pulse className="h-3.5 w-16" />
            <Pulse className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecommendationSkeleton() {
  return (
    <div className="space-y-3">
      <Pulse className="h-6 w-48" />
      <Pulse className="h-5 w-full rounded-full" />
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-4 w-20" />
        ))}
      </div>
    </div>
  );
}

export function NewsSkeleton() {
  return (
    <div className="space-y-3">
      <Pulse className="h-6 w-28" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-3">
          <Pulse className="h-16 w-24 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-4 w-full" />
            <Pulse className="h-4 w-3/4" />
            <Pulse className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="space-y-8">
      <HeaderSkeleton />
      <div className="grid gap-8 lg:grid-cols-2">
        <MetricsSkeleton />
        <div className="space-y-8">
          <ProfileSkeleton />
          <RecommendationSkeleton />
        </div>
      </div>
      <NewsSkeleton />
    </div>
  );
}
