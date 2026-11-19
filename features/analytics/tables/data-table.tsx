type Column<T> = {
  key: keyof T;
  label: string;
  align?: "left" | "center" | "right";
  format?: (value: any) => string | number;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-center">
        <p className="text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line bg-slate-50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-3 text-sm font-semibold text-ink ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-0 hover:bg-slate-50">
              {columns.map((col) => {
                const value = row[col.key];
                const displayValue = col.format ? col.format(value) : value;
                return (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-sm text-slate-700 ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
