type Props = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
};

export function Field({ label, name, type = "text", autoComplete, error, defaultValue, hint, required = true, maxLength }: Props) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}{!required && <span className="font-normal text-ink-muted"> (optional)</span>}</label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
      />
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-ink-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
