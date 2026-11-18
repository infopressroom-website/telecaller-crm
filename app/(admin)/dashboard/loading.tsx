import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="flex flex-col gap-5">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-80" />)}
      </div>
    </div>
  );
}
