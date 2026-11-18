import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DispositionForm } from "@/features/settings/disposition-form";
import { requirePagePermission } from "@/lib/auth/session";
import { listDispositions } from "@/services/disposition-service";

export const metadata: Metadata = { title: "Call outcomes" };
export const dynamic = "force-dynamic";

export default async function DispositionsPage() {
  const user = await requirePagePermission("settings", "MANAGE");
  const list = await listDispositions(user);
  return (
    <>
      <PageHeader title="Call outcomes" description="Agents pick one of these after every call. Built-in outcomes can be renamed and reordered but not removed, because reports and lead rules depend on them. Outcomes already used on calls can only be hidden, never deleted." />
      <Card><h2 className="mb-3 text-base font-semibold">Add an outcome</h2><DispositionForm /></Card>
      <div className="flex flex-col gap-3">{list.map((d) => <DispositionForm key={d.id} v={d} />)}</div>
    </>
  );
}
