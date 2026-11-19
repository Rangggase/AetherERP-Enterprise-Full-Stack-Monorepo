import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Field } from "../components/Form";
import { useSession } from "../lib/session";
import { Key } from "../components/Key";
import { Glyph } from "../components/glyphs";

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
    <main className="grid min-h-dvh bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col items-center justify-center gap-6 p-6">
        <DeskArt className="h-[120px] w-auto md:hidden" />
        <form onSubmit={submit} className="sheet w-full max-w-sm space-y-5 px-6 py-7" noValidate>
          <p className="flex items-center gap-2.5 font-serif text-[17px] font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded bg-brand text-sm text-surface shadow-[0_2px_0_rgb(var(--accent-deep))]" aria-hidden="true">A</span>AetherERP
          </p>
          <div>
            <h1 className="font-serif text-xl font-medium">Masuk</h1>
            <p className="mt-1 text-table text-muted">Gunakan akun perusahaan Anda.</p>
          </div>
          {error && <p role="alert" className="flex items-start gap-2 border-y border-bad py-3 text-sm text-bad"><Glyph name="peringatan" size={18} />{error}</p>}
          <Field label="Email"><input className="field" type="email" name="email" autoComplete="username" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Kata sandi"><input className="field" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Key type="submit" tone="primary" glyph="kirim" className="w-full" pending={busy} disabled={!email || !password}>Masuk</Key>
        </form>
      </div>
      <Parallax />
    </main>
  );
}

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Right column: the desk drawing, with a subtle parallax that follows the pointer (6 px at most, off with reduced motion). */
function Parallax() {
  const far = useRef<SVGGElement>(null);
  const near = useRef<SVGGElement>(null);
  const frame = useRef(0);
  function move(e: React.PointerEvent<HTMLElement>) {
    if (reduced() || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2, dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      far.current?.setAttribute("transform", `translate(${(dx * 2).toFixed(2)} ${(dy * 2).toFixed(2)})`);
      near.current?.setAttribute("transform", `translate(${(dx * 6).toFixed(2)} ${(dy * 6).toFixed(2)})`);
    });
  }
  return (
    <aside className="hidden flex-col justify-between border-l border-line bg-highlight/40 p-12 md:flex" onPointerMove={move}
      onPointerLeave={() => { far.current?.removeAttribute("transform"); near.current?.removeAttribute("transform"); }}>
      <p className="max-w-sm font-serif text-xl font-medium">Pengadaan, gudang, penjualan, dan akuntansi dalam satu buku besar.</p>
      <DeskArt className="mx-auto h-auto w-full max-w-[460px]" farRef={far} nearRef={near} />
      <ul className="max-w-sm space-y-1.5 text-sm text-muted">
        <li>Stok per gudang dengan biaya FIFO.</li>
        <li>Jurnal ganda yang tidak bisa diubah setelah diposting.</li>
        <li>Laporan yang selalu cocok dengan buku besar.</li>
      </ul>
    </aside>
  );
}

/** Isometric line drawing: a warehouse rack behind an open ledger. One colour #6B645A, 1 px, decorative. */
function DeskArt({ className, farRef, nearRef }: { className?: string; farRef?: React.Ref<SVGGElement>; nearRef?: React.Ref<SVGGElement> }) {
  return (
    <svg viewBox="0 0 360 250" className={className} fill="none" stroke="#6B645A" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M40 170 180 240l140-70-140-70z" strokeDasharray="3 4" />
      <g ref={farRef}>
        {/* rack */}
        <path d="M170 40 230 10l60 30-60 30z" /><path d="M170 80 230 50l60 30-60 30z" /><path d="M170 120 230 90l60 30-60 30z" />
        <path d="M170 40v80M290 40v80M230 70v80" /><path d="M230 10v40" strokeDasharray="2 3" />
        <path d="M196 46l14-7 14 7-14 7zM196 46v-12l14-7 14 7v12M210 39v-12" />
        <path d="M244 86l14-7 14 7-14 7zM244 86v-8l14-7 14 7v8" />
      </g>
      <g ref={nearRef}>
        {/* open ledger */}
        <path d="M70 150l80-40 80 40-80 40z" />
        <path d="M150 110v-6l-80 40v6M150 104l80 40v6" />
        <path d="M150 110v80" />
        <path d="M92 150l46-23M98 156l46-23M104 162l46-23M110 168l34-17" />
        <path d="M162 127l46 23M156 133l46 23M150 139l40 20" />
        <path d="M118 120l12 6M188 158l12 6" strokeDasharray="2 3" />
        {/* pen */}
        <path d="M232 168l40-20 4 2-40 20z" /><path d="M232 168l-6 4 10-2" />
      </g>
    </svg>
  );
}
