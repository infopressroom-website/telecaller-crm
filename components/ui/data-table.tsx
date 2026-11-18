"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";

export type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode };

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T>({
  columns, rows, getRowId, isLoading, error, onRetry,
  emptyTitle = "Nothing here yet", emptyDescription,
}: Props<T>) {
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load data"
        description={error}
        action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 font-semibold">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={getRowId(row)} className="border-b border-slate-100 hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-3">{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!isLoading && rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
    </div>
  );
}

export function Pagination({
  page, totalPages, onPageChange,
}: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-3 text-sm">
      <span className="text-ink-muted">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
