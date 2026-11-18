type Option = { value: string; label: string };

export function SelectField({
  label, name, options, defaultValue, error, required = false, placeholder,
}: {
  label: string; name: string; options: Option[]; defaultValue?: string; error?: string; required?: boolean; placeholder?: string;
}) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select
        id={id} name={name} defaultValue={defaultValue ?? ""} required={required}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
