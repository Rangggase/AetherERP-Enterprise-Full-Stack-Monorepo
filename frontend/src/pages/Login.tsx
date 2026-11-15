import { Landmark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";

export function Login() {
  const s = useSession();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (s.me) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await s.signIn(email.trim(), password);
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-rail p-10 text-rail-ink lg:flex">
        <div className="flex items-center gap-2 text-white"><Landmark size={22} className="text-brand" aria-hidden /><span className="text-lg font-semibold">AetherERP</span></div>
        <div>
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">Every receipt, delivery and payment lands in the ledger the moment it happens.</p>
          <p className="mt-4 max-w-md text-sm">Multi-branch stock on FIFO layers, double-entry journals that cannot be edited after posting, and statements that tie out to the cent.</p>
        </div>
        <p className="text-xs">Procurement, warehouse, sales and accounting in one system.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Use your company account.</p>
          </div>
          {error && <p role="alert" className="rounded-md border border-bad/40 bg-bad/5 p-2.5 text-sm text-bad">{error}</p>}
          <label className="block text-sm font-medium">
            Email
            <input className="field mt-1 h-10" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input className="field mt-1 h-10" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn btn-primary h-10 w-full" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
