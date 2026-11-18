export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-900">{error}</p>;
  if (success) return <p role="status" className="rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-900">{success}</p>;
  return null;
}
