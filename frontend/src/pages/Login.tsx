import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Field } from "../components/Form";
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
      setError(err instanceof Error ? err.message : "Gagal masuk. Periksa email dan kata sandi, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between border-r border-line p-12 md:flex">
        <p className="font-serif text-[17px] font-semibold">AetherERP</p>
        <div>
          <p className="max-w-sm font-serif text-xl font-medium">Pengadaan, gudang, penjualan, dan akuntansi dalam satu buku besar.</p>
          <ul className="mt-6 max-w-sm space-y-2 text-sm text-muted">
            <li>Stok per gudang dengan biaya FIFO.</li>
            <li>Jurnal ganda yang tidak bisa diubah setelah diposting.</li>
            <li>Laporan yang selalu cocok dengan buku besar.</li>
          </ul>
        </div>
        <p className="text-xs text-muted">Masuk dengan akun perusahaan Anda.</p>
      </aside>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
          <p className="font-serif text-[17px] font-semibold md:hidden">AetherERP</p>
          <div>
            <h1 className="font-serif text-xl font-medium">Masuk</h1>
            <p className="mt-1 text-table text-muted">Gunakan akun perusahaan Anda.</p>
          </div>
          {error && <p role="alert" className="border-y border-bad py-3 text-sm text-bad">{error}</p>}
          <Field label="Email"><input className="field" type="email" name="email" autoComplete="username" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Kata sandi"><input className="field" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <button className="btn btn-primary w-full" disabled={busy || !email || !password}>{busy ? "Memproses…" : "Masuk"}</button>
        </form>
      </div>
    </main>
  );
}
