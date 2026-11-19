import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { openJournal, useJournal } from "../lib/journals";
import { useSession } from "../lib/session";
import { play } from "../motion/animate";
import { exitMs, ms } from "../motion/tokens";
import { chime } from "../motion/sound";
import { Glyph } from "./glyphs";

/**
 * Struk (5.2, 8): baki pemberitahuan di kanan atas. Upacara Posting (M2) mengirim struk berisi akibat aksi
 * yang dikembalikan API: nomor dokumen, jumlah, perubahan stok, nomor jurnal. Paling banyak 3 bertumpuk,
 * tetap tampil saat pindah halaman, hilang sendiri setelah --receipt-life kecuali di-hover atau difokus.
 */
export interface ReceiptLine { label: string; value: string; mono?: boolean }
export interface ReceiptData {
  kind?: "ok" | "error";
  title: string;
  number?: string;
  lines?: ReceiptLine[];
  stock?: { sku: string; change: string }[];
  journalId?: number | null;
  journalDate?: string;
  link?: { to: string; label: string };
  note?: string;
}
interface Item extends ReceiptData { id: number }
let seq = 0;

export const receipt = (r: ReceiptData): void => {
  window.dispatchEvent(new CustomEvent<Item>("aether:receipt", { detail: { ...r, id: ++seq } }));
};
/** Pesan singkat (bukan posting): satu baris di struk. */
export const toast = (text: string, kind: "ok" | "error" = "ok"): void => receipt({ title: text, kind });

function JournalNo({ id }: { id: number }) {
  const q = useJournal(id);
  return <dd className="text-right">{q.data?.entry_no ?? (q.isLoading ? "…" : `#${id}`)}</dd>;
}

function Receipt({ r, onDone }: { r: Item; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const { can } = useSession();
  const bad = r.kind === "error";
  const close = () => {
    window.clearTimeout(timer.current);
    const a = play(ref.current, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(8px)" }], { duration: exitMs("dur-print"), easing: "in" });
    if (a) a.onfinish = () => onDone(r.id); else onDone(r.id);
  };
  const arm = (t: number) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(close, t); };
  useEffect(() => {
    arm(ms("receipt-life"));
    if (!bad) chime("struk");
    return () => window.clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const showJournal = !!r.journalId && can("accounting.read");
  return (
    <div ref={ref} className="struk struk-print" role="group" aria-label={`Struk: ${r.title}`}
      onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={() => arm(ms("receipt-life") / 2)}
      onFocus={() => window.clearTimeout(timer.current)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) arm(ms("receipt-life") / 2); }}>
      <div className="struk-paper">
        <div className="flex items-start gap-2">
          <span className={bad ? "text-bad" : "text-good"}><Glyph name={bad ? "gagal" : "struk"} size={18} /></span>
          <p className={clsx("min-w-0 flex-1 font-medium leading-5", bad && "text-bad")}>{r.title}</p>
          <button type="button" className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded text-muted hover:bg-highlight hover:text-ink" onClick={close} aria-label="Tutup struk"><Glyph name="tutup" size={16} /></button>
        </div>
        {r.number && <p className="mono mt-0.5 pl-[26px] text-ink" translate="no">{r.number}</p>}
        {(r.lines?.length || r.stock?.length || showJournal) ? <hr /> : null}
        {r.lines && r.lines.length > 0 && (
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
            {r.lines.map((l) => <div key={l.label} className="contents"><dt className="text-muted">{l.label}</dt><dd className="text-right">{l.value}</dd></div>)}
          </dl>
        )}
        {r.stock && r.stock.length > 0 && (
          <>
            <hr />
            <p className="text-muted">Perubahan stok</p>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
              {r.stock.map((s) => <div key={s.sku} className="contents"><dt className="mono" translate="no">{s.sku}</dt><dd className="text-right">{s.change}</dd></div>)}
            </dl>
          </>
        )}
        {showJournal && (
          <>
            <hr />
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3"><dt className="text-muted">Jurnal</dt><JournalNo id={r.journalId!} /></dl>
          </>
        )}
        {r.note && <p className="mt-2 text-xs text-muted">{r.note}</p>}
        {(showJournal || r.link) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {showJournal && <button type="button" className="inline-flex min-h-8 items-center gap-1 text-table font-medium text-brand hover:underline" onClick={() => openJournal({ id: r.journalId!, date: r.journalDate })}><Glyph name="tinta" size={15} />Lihat jejak tinta</button>}
            {r.link && <Link to={r.link.to} className="inline-flex min-h-8 items-center gap-1 text-table text-brand hover:underline">{r.link.label}<Glyph name="kirim" size={14} /></Link>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const on = (e: Event) => setItems((x) => [(e as CustomEvent<Item>).detail, ...x].slice(0, 3));
    window.addEventListener("aether:receipt", on);
    return () => window.removeEventListener("aether:receipt", on);
  }, []);
  const done = (id: number) => setItems((x) => x.filter((i) => i.id !== id));
  return (
    <div className="pointer-events-none fixed right-3 top-[60px] z-receipt flex flex-col items-end gap-3 print:hidden" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => <Receipt key={t.id} r={t} onDone={done} />)}
    </div>
  );
}
