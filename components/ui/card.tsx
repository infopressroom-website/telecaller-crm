import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-card border border-line bg-white p-5", className)} {...rest} />;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </Card>
  );
}
