import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Field } from "../components/Field";
import { Glyph } from "../components/glyphs";
import { Key } from "../components/Key";
import { FEATURES } from "../config/features";
import { useSession } from "../lib/session";
import { play } from "../motion/animate";
import { cssVar, ms } from "../motion/tokens";
import { transitionTo } from "../motion/viewTransition";

const OPENED = "aether.book-opened";
const seen = () => { try { return sessionStorage.getItem(OPENED) === "1"; } catch { return true; } };
const mark = () => { try { sessionStorage.setItem(OPENED, "1"); } catch { /* abaikan */ } };

/**
 * Masuk (10): dua kolom; kiri form di atas lembar kertas, kanan ilustrasi isometrik garis dengan paralaks halus (maksimal
 * --parallax-max, mati saat gerak dikurangi). Masuk berhasil memicu M11 Membuka Buku sekali per sesi browser; data dasbor
 * mulai dimuat bersamaan. Gagal masuk: lembar bergetar halus dan pesan galat tampil. Ada indikator Caps Lock.
 */
export function Login() {
  const s = useSession();
  const nav = useNavigate();
  const sheet = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState(false);
  /** Selama Membuka Buku berjalan, halaman ini tetap tampil sampai transisi menavigasi sendiri. */
  const leaving = useRef(false);

  if (s.me && !leaving.current) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(!email.trim() ? "Isi email akun perusahaan Anda." : "Isi kata sandi Anda.");
      (sheet.current?.querySelector<HTMLInputElement>(!email.trim() ? "input[name=email]" : "input[name=password]"))?.focus();
      return;
    }
    setBusy(true);
    try {
      leaving.current = true;
      await s.signIn(email.trim(), password);
      const go = () => nav("/", { replace: true });
      if (FEATURES.openBook && !seen()) {
        mark();
        document.documentElement.dataset.book = "";
        transitionTo(go, { source: sheet.current, name: "book" });
        window.setTimeout(() => { delete document.documentElement.dataset.book; }, ms("dur-open-book") * 2);
      } else go();
    } catch (err) {
      leaving.current = false;
      setError(err instanceof Error ? err.message : "Gagal masuk. Periksa email dan kata sandi, lalu coba lagi.");
      play(sheet.current, [0, -5, 5, -4, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: "dur-shake", easing: "linear", reduced: null });
    } finally {
      setBusy(false);
    }
  }
  const capsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);

  return (
    <main className="grid min-h-dvh bg-canvas md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col items-center justify-center gap-6 p-6">
        <DeskArt className="h-[132px] w-auto md:hidden" />
        <form ref={sheet} onSubmit={submit} className="sheet w-full max-w-sm space-y-5 px-6 py-7" noValidate>
          <p className="flex items-center gap-2.5 font-serif text-[17px] font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded bg-brand text-sm text-surface shadow-[0_2px_0_rgb(var(--accent-deep))]" aria-hidden="true">A</span>AetherERP
          </p>
          <div>
            <h1 className="font-serif text-xl font-medium">Masuk</h1>
            <p className="mt-1 text-table text-muted">Gunakan akun perusahaan Anda.</p>
          </div>
          {error && <p role="alert" className="flex items-start gap-2 border-y border-bad py-3 text-sm text-bad"><Glyph name="peringatan" size={18} />{error}</p>}
          <Field label="Email"><input className="field" type="email" name="email" autoComplete="username" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Kata sandi" error={caps ? "Caps Lock aktif. Huruf kapital mungkin tidak sengaja." : null}>
            <input className="field" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={capsCheck} onKeyDown={capsCheck} onBlur={() => setCaps(false)} />
          </Field>
          <Key type="submit" tone="primary" glyph="kirim" className="w-full" pending={busy}>Masuk ke buku besar</Key>
        </form>
      </div>
      <Parallax />
    </main>
  );
}

/** Kolom kanan: ilustrasi meja dengan paralaks halus mengikuti penunjuk (maksimal --parallax-max; 0 saat gerak dikurangi). */
function Parallax() {
  const far = useRef<SVGGElement>(null);
  const near = useRef<SVGGElement>(null);
  const frame = useRef(0);
  function move(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const max = parseFloat(cssVar("parallax-max")) || 0;
    if (!max) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2, dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      far.current?.setAttribute("transform", `translate(${(dx * max / 3).toFixed(2)} ${(dy * max / 3).toFixed(2)})`);
      near.current?.setAttribute("transform", `translate(${(dx * max).toFixed(2)} ${(dy * max).toFixed(2)})`);
    });
  }
  return (
    <aside className="hidden flex-col justify-between border-l border-line bg-highlight/40 p-12 md:flex" onPointerMove={move}
      onPointerLeave={() => { far.current?.removeAttribute("transform"); near.current?.removeAttribute("transform"); }}>
      <p className="max-w-sm font-serif text-xl font-medium">Pengadaan, gudang, penjualan, dan akuntansi dalam satu buku besar.</p>
      <DeskArt className="mx-auto h-auto w-full max-w-[480px]" farRef={far} nearRef={near} />
      <ul className="max-w-sm space-y-1.5 text-sm text-muted">
        <li>Stok per gudang dengan biaya FIFO.</li>
        <li>Jurnal ganda yang tidak bisa diubah setelah diposting.</li>
        <li>Laporan yang selalu cocok dengan buku besar.</li>
      </ul>
    </aside>
  );
}

type V3 = [number, number, number];
const S = 14;
const iso = ([x, y, z]: V3) => `${(180 + (x - y) * 0.866 * S).toFixed(1)} ${(120 + (x + y) * 0.5 * S - z * S).toFixed(1)}`;
const L = (...p: V3[]) => `M${p.map(iso).join("L")}`;
const Z = (...p: V3[]) => `${L(...p)}Z`;
function box(x: number, y: number, z: number, w: number, d: number, h: number) {
  const [x1, y1, z1] = [x + w, y + d, z + h];
  return [Z([x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]), L([x1, y, z1], [x1, y, z]), L([x1, y1, z1], [x1, y1, z]), L([x, y1, z1], [x, y1, z]), L([x, y1, z], [x1, y1, z], [x1, y, z])].join(" ");
}

/** Ilustrasi isometrik garis (30°), satu warna --ink-muted, 1,25 px: buku besar terbuka, cap, gulungan struk, rak. */
function DeskArt({ className, farRef, nearRef }: { className?: string; farRef?: React.Ref<SVGGElement>; nearRef?: React.Ref<SVGGElement> }) {
  return (
    <svg viewBox="0 0 360 260" className={`${className ?? ""} text-muted`} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d={Z([-6, -6, 0], [10, -6, 0], [10, 10, 0], [-6, 10, 0])} strokeDasharray="3 4" />
      <g ref={farRef}>
        {/* rak */}
        <path d={[L([-4, -4, 0], [-4, -4, 8]), L([4, -4, 0], [4, -4, 8]), L([4, -2, 0], [4, -2, 8]), L([-4, -2, 0], [-4, -2, 8]),
          Z([-4, -4, 4], [4, -4, 4], [4, -2, 4], [-4, -2, 4]), Z([-4, -4, 8], [4, -4, 8], [4, -2, 8], [-4, -2, 8])].join(" ")} />
        <path d={box(-3, -3.7, 4, 1.6, 1.3, 1.2)} />
        <path d={box(1, -3.7, 4, 2, 1.3, 1.6)} />
        <path d={box(-1.5, -3.7, 0, 2.2, 1.3, 2)} />
      </g>
      <g ref={nearRef}>
        {/* buku besar terbuka */}
        <path d={[Z([0, 1, 0.3], [6, 1, 0.3], [6, 4, 0.6], [0, 4, 0.6]), Z([0, 4, 0.6], [6, 4, 0.6], [6, 7, 0.3], [0, 7, 0.3]), L([0, 1, 0.3], [0, 1, 0], [6, 1, 0], [6, 1, 0.3]), L([6, 7, 0.3], [6, 7, 0])].join(" ")} />
        <path d={[L([0.8, 1.8, 0.38], [5.2, 1.8, 0.38]), L([0.8, 2.6, 0.46], [5.2, 2.6, 0.46]), L([0.8, 3.4, 0.54], [4.2, 3.4, 0.54]), L([0.8, 4.8, 0.52], [5.2, 4.8, 0.52]), L([0.8, 5.6, 0.44], [5.2, 5.6, 0.44]), L([0.8, 6.4, 0.36], [3.6, 6.4, 0.36])].join(" ")} strokeDasharray="2 3" />
        {/* cap */}
        <path d={box(7.2, 3.2, 0, 1.8, 1.8, 0.5)} />
        <path d={box(7.7, 3.7, 0.5, 0.8, 0.8, 1.4)} />
        {/* gulungan struk */}
        <path d={`${box(1.5, 8.5, 0, 3, 1.4, 1.4)} ${L([2, 9.9, 0], [2, 12.5, 0], [2.4, 12.2, 0], [2.8, 12.5, 0], [3.2, 12.2, 0], [3.6, 12.5, 0], [4, 12.2, 0], [4, 9.9, 0])}`} />
        <path d={[L([2.3, 10.8, 0], [3.7, 10.8, 0]), L([2.3, 11.5, 0], [3.4, 11.5, 0])].join(" ")} strokeDasharray="2 3" />
      </g>
    </svg>
  );
}
