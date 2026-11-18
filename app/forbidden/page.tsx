import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { homePathFor } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "No access" };

export default async function ForbiddenPage() {
  const user = await requireUser();
  return (
    <main className="grid min-h-screen place-items-center p-4 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <ShieldAlert className="h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-sm text-ink-muted">Ask an administrator if you think you should.</p>
        <Link href={homePathFor(user)} className="text-sm text-brand-700 underline">Go to my home</Link>
      </div>
    </main>
  );
}
