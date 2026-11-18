import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePagePermission("settings", "MANAGE");
  const items = [
    { href: "/settings/telephony", title: "Telephony", text: "Calling provider, test call, agent phone numbers and webhook health." },
    { href: "/settings/dispositions", title: "Call outcomes", text: "The outcomes agents choose after a call, and what each one does." },
    { href: "/settings/ai", title: "AI assistant", text: "Optional transcript summaries for QA reviewers (off by default)." },
    { href: "/audit", title: "Audit log", text: "Who did what and when: logins, assignments, exports, settings." },
  ];
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.href}><Link href={i.href} className="text-base font-semibold text-brand-700 underline">{i.title}</Link><p className="mt-1 text-sm text-ink-muted">{i.text}</p></Card>
        ))}
      </div>
    </>
  );
}
