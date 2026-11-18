export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2 font-bold">
          <span className="h-7 w-7 rounded-lg bg-brand" aria-hidden />
          Telecaller CRM
        </div>
        {children}
      </div>
    </main>
  );
}
