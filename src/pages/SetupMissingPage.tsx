export default function SetupMissingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="glass max-w-lg space-y-3 p-8">
        <h1 className="text-2xl font-bold text-forest">Almost there: add your Supabase keys</h1>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink">
          <li>Copy <code className="rounded bg-mint px-1">.env.example</code> to a new file named <code className="rounded bg-mint px-1">.env</code>.</li>
          <li>Open Supabase, then Project Settings, then API.</li>
          <li>Paste the Project URL into <code className="rounded bg-mint px-1">VITE_SUPABASE_URL</code>.</li>
          <li>Paste the anon (public) key into <code className="rounded bg-mint px-1">VITE_SUPABASE_ANON_KEY</code>.</li>
          <li>Stop the dev server (Ctrl+C) and run <code className="rounded bg-mint px-1">npm run dev</code> again.</li>
        </ol>
        <p className="text-sm text-muted">Never paste the service_role key here.</p>
      </div>
    </div>
  );
}
