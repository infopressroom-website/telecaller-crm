export function TextAreaField({
  label, name, defaultValue, error, required = false, maxLength = 2000, rows = 3,
}: { label: string; name: string; defaultValue?: string; error?: string; required?: boolean; maxLength?: number; rows?: number }) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}{!required && <span className="font-normal text-ink-muted"> (optional)</span>}</label>
      <textarea
        id={id} name={name} defaultValue={defaultValue} required={required} maxLength={maxLength} rows={rows}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
