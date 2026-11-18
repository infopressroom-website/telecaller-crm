"use client";

import { useFormState } from "react-dom";
import { validateImportAction } from "@/app/actions/imports";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { IMPORT_FIELDS } from "@/lib/leads/fields";

export function MappingForm({
  batchId, headers, mapping, preview,
}: { batchId: string; headers: string[]; mapping: Record<string, string>; preview: Record<string, string>[] }) {
  const [state, action] = useFormState(validateImportAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="batchId" value={batchId} />
      <p className="text-sm text-ink-muted">Match each column in your file to a lead field. <strong>Name</strong> and <strong>Primary mobile</strong> are required. Columns set to “Ignore” are not imported.</p>
      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {headers.map((h) => (
                <th key={h} scope="col" className="min-w-44 px-3 py-2 align-top">
                  <div className="mb-1 font-semibold">{h}</div>
                  <select name={`map:${h}`} defaultValue={mapping[h] ?? ""} aria-label={`Field for column ${h}`} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal">
                    <option value="">Ignore</option>
                    {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b border-slate-100">
                {headers.map((h) => <td key={h} className="max-w-56 truncate px-3 py-2">{row[h]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">Preview shows the first {preview.length} rows.</p>
      <FormMessage error={state?.error} />
      <div className="md:w-56"><SubmitButton>Check my data</SubmitButton></div>
    </form>
  );
}
