"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";

type Opt = { id: string; name: string };

export function ImportUpload({ sources, campaigns }: { sources: Opt[]; campaigns: Opt[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const res = await fetch("/api/leads/import", { method: "POST", body: new FormData(e.currentTarget) });
      const json = await res.json();
      if (!res.ok) setError(json?.error?.message ?? "Upload failed.");
      else router.push(`/leads/import/${json.data.id}`);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="file" className="text-sm font-medium">File (.csv or .xlsx, up to 5 MB and 20,000 rows)</label>
        <input id="file" name="file" type="file" required accept=".csv,.xlsx" className="rounded-lg border border-slate-300 bg-white p-2 text-sm" />
        <p className="text-xs text-ink-muted">The first row must contain column names.</p>
      </div>
      <SelectField label="Campaign for these leads" name="campaignId" placeholder="No campaign" options={campaigns.map((c) => ({ value: c.id, label: c.name }))} />
      <SelectField label="Default source" name="sourceId" placeholder="No default source" options={sources.map((s) => ({ value: s.id, label: s.name }))} />
      <div className="md:col-span-2"><FormMessage error={error} /></div>
      <div className="md:w-48"><Button type="submit" loading={busy} className="w-full">{busy ? "Uploading…" : "Upload and continue"}</Button></div>
    </form>
  );
}
