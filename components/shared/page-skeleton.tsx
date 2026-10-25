import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 bg-cream-deep" />
        <Skeleton className="h-8 w-64 bg-cream-deep" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl bg-cream-deep" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl bg-cream-deep" />
        ))}
      </div>
    </div>
  );
}
