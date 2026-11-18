import Link from "next/link";
import { can, type AuthUser } from "@/lib/auth/rbac";

export function DistributionNav({ user, active }: { user: AuthUser; active: "overview" | "rules" | "agents" | "approvals" }) {
  const items = [
    { key: "overview", href: "/distribution", label: "Overview & run" },
    { key: "rules", href: "/distribution/rules", label: "Rules" },
    { key: "agents", href: "/distribution/agents", label: "Agents & limits" },
    ...(can(user, "distribution", "VIEW") ? [{ key: "approvals", href: "/distribution/approvals", label: "Approvals" }] : []),
  ];
  return (
    <nav aria-label="Distribution sections" className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${i.key === active ? "bg-brand text-white" : "border border-line bg-white"}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
