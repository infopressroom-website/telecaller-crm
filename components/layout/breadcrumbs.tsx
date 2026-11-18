"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ADMIN_NAV, TELECALLER_NAV } from "@/config/navigation";

const LABELS = new Map([...TELECALLER_NAV, ...ADMIN_NAV].map((n) => [n.href, n.label]));
const titleCase = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { href, label: LABELS.get(href) ?? titleCase(seg) };
  });

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
      <ol className="flex items-center gap-1">
        <li>Home</li>
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-medium text-ink">{c.label}</span>
            ) : (
              <Link href={c.href} className="hover:text-ink">{c.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
