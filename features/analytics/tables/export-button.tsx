"use client";

import { Download } from "lucide-react";
import { useState } from "react";

type ExportButtonProps = {
  filters: Record<string, string | undefined>;
};

export function ExportButton({ filters }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`/api/analytics/export?${params.toString()}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
        className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        disabled={loading}
      >
        <option value="csv">CSV</option>
        <option value="xlsx">Excel</option>
      </select>
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Download size={16} />
        {loading ? "Exporting..." : "Export"}
      </button>
    </div>
  );
}
