import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FEATURES } from "../../config/features";
import { date, rupiah } from "../../lib/format";
import { cents, type JournalLine } from "../../lib/journals";
import { drawStroke, finishAll, play } from "../../motion/animate";
import { motionLevel, ms } from "../../motion/tokens";
import { Glyph } from "../glyphs";
import "./InkThreads.css";
import "../../styles/tables.css";

export interface InkJournal { entry_no: string; entry_date: string; description: string; source_type: string | null; lines: JournalLine[] }

const SOURCE: Record<string, string> = {
  SALES_RETURN: "Retur penjualan", DELIVERY: "Pengiriman", INVOICE: "Faktur", PAYMENT: "Pembayaran", GRN: "Penerimaan barang",
  WORK_ORDER: "Perakitan", MANUAL: "Jurnal manual", OPENING: "Saldo awal", CLOSING: "Jurnal penutup", STOCK_COUNT: "Stock opname", REVERSAL: "Jurnal pembalik",
};
export const sourceLabel = (s: string | null | undefined): string => (s ? SOURCE[s] ?? s.toLowerCase().replace(/_/g, " ") : "Jurnal");

interface Side { code: string; name: string; amount: number }
function group(lines: JournalLine[], key: "debit" | "credit"): Side[] {
  const m = new Map<string, Side>();
  for (const l of lines) {
    const v = cents(l[key]);
    if (v <= 0) continue;
    const s = m.get(l.account_code) ?? { code: l.account_code, name: l.account_name, amount: 0 };
    s.amount += v;
    m.set(l.account_code, s);
  }
  return [...m.values()];
}
const idr = (c: number) => rupiah(c / 100, c % 100 !== 0);

interface Thread { key: string; d: string; width: number; side: "debit" | "credit" }

/**
 * M1 Jejak Tinta: setiap transaksi tercatat di dua sisi dan seimbang. Kartu akun Debit di kiri, lembar jurnal di tengah,
 * kartu akun Kredit di kanan. Benang tinta tergambar dari dokumen ke setiap kartu, debit dulu lalu kredit (--dur-thread,
 * jeda --gap-thread), tebalnya 1,5–5 px sebanding jumlah. Lalu timbangan menjadi datar (--dur-level) dan ringkasan tampil.
 * Bila total tidak sama, timbangan tetap miring dan galat "Tidak seimbang" tampil. Total ≤1.200 ms, sekali per tampilan.
 */
export function InkThreads({ journal, autoplay = true }: { journal: InkJournal; autoplay?: boolean }) {
  const debits = group(journal.lines, "debit");
  const credits = group(journal.lines, "credit");
  const dSum = debits.reduce((s, x) => s + x.amount, 0);
  const cSum = credits.reduce((s, x) => s + x.amount, 0);
  const balanced = dSum === cSum && dSum > 0;
  const maxAmt = Math.max(1, ...debits.map((x) => x.amount), ...credits.map((x) => x.amount));

  const grid = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const scaleRef = useRef<HTMLSpanElement>(null);
  const sumRef = useRef<HTMLParagraphElement>(null);
  const anims = useRef<(Animation | null)[]>([]);
  const played = useRef(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const g = grid.current, doc = docRef.current;
    if (!g || !doc) return;
    finishAll(anims.current);
    const gr = g.getBoundingClientRect();
    const dr = doc.getBoundingClientRect();
    const vertical = gr.width < 640;
    const rel = (r: DOMRect) => ({ l: r.left - gr.left, r: r.right - gr.left, t: r.top - gr.top, b: r.bottom - gr.top, cx: r.left - gr.left + r.width / 2, cy: r.top - gr.top + r.height / 2 });
    const D = rel(dr);
    const out: Thread[] = [];
    (["debit", "credit"] as const).forEach((side) => {
      const list = side === "debit" ? debits : credits;
      list.forEach((acc, i) => {
        const el = cardRefs.current.get(`${side}-${acc.code}`);
        if (!el) return;
        const C = rel(el.getBoundingClientRect());
        const spread = (i + 1) / (list.length + 1);
        let d: string;
        if (vertical) {
          const sx = D.l + (D.r - D.l) * spread;
          const sy = side === "debit" ? D.t : D.b;
          const ey = side === "debit" ? C.b : C.t;
          const my = (sy + ey) / 2;
          d = `M${sx.toFixed(1)} ${sy.toFixed(1)} C${sx.toFixed(1)} ${my.toFixed(1)} ${C.cx.toFixed(1)} ${my.toFixed(1)} ${C.cx.toFixed(1)} ${ey.toFixed(1)}`;
        } else {
          const sx = side === "debit" ? D.l : D.r;
          const sy = D.t + (D.b - D.t) * spread;
          const ex = side === "debit" ? C.r : C.l;
          const mx = (sx + ex) / 2;
          d = `M${sx.toFixed(1)} ${sy.toFixed(1)} C${mx.toFixed(1)} ${sy.toFixed(1)} ${mx.toFixed(1)} ${C.cy.toFixed(1)} ${ex.toFixed(1)} ${C.cy.toFixed(1)}`;
        }
        out.push({ key: `${side}-${acc.code}`, d, side, width: 1.5 + 3.5 * (acc.amount / maxAmt) });
      });
    });
    setBox({ w: gr.width, h: gr.height });
    setThreads(out);
  }, [journal]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (grid.current) ro.observe(grid.current);
    return () => ro.disconnect();
  }, [measure]);

  const run = useCallback(() => {
    finishAll(anims.current);
    if (!FEATURES.inkThreads || motionLevel() !== "full") return;
    const T = ms("dur-thread"), g = ms("gap-thread"), lvl = ms("dur-level"), fade = ms("dur-fade");
    const nD = threads.filter((t) => t.side === "debit").length, nC = threads.length - nD;
    const debitEnd = Math.max(0, nD - 1) * g + T;
    const rawEnd = debitEnd + g + Math.max(0, nC - 1) * g + T;
    // Seluruh upacara paling lama 1.200 ms: jeda dan durasi dipadatkan bila jurnal punya banyak baris.
    const k = Math.min(1, (ms("budget-ink") - lvl - fade) / rawEnd);
    const list: (Animation | null)[] = [];
    let iD = 0, iC = 0;
    for (const t of threads) {
      const delay = t.side === "debit" ? iD++ * g * k : (debitEnd + g + iC++ * g) * k;
      list.push(drawStroke(pathRefs.current.get(t.key) ?? null, { duration: T * k, delay, easing: "inout" }));
    }
    const end = rawEnd * k;
    if (balanced) list.push(play(scaleRef.current, [{ transform: "rotate(-14deg)" }, { transform: "rotate(0deg)" }], { duration: lvl, delay: end, easing: "out", fill: "backwards", reduced: null }));
    list.push(play(sumRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: fade, delay: end + (balanced ? lvl : 0), fill: "backwards", reduced: null }));
    anims.current = list;
  }, [threads, balanced]);

  // Diputar sekali per tampilan, setelah posisi benang pertama kali diukur.
  useEffect(() => {
    if (!autoplay || played.current || threads.length === 0) return;
    played.current = true;
    run();
  }, [threads, autoplay, run]);
  useEffect(() => () => finishAll(anims.current), []);

  const card = (side: "debit" | "credit") => (a: Side) => (
    <div key={a.code} ref={(el) => { if (el) cardRefs.current.set(`${side}-${a.code}`, el); else cardRefs.current.delete(`${side}-${a.code}`); }} className="ink-card">
      <p className="text-xs text-muted"><span className="code" translate="no">{a.code}</span> · {a.name}</p>
      <p className="amt">{idr(a.amount)}</p>
    </div>
  );

  return (
    <figure className="ink-threads">
      <div ref={grid} className="ink-grid" aria-hidden="true">
        <svg className="ink-svg" viewBox={`0 0 ${box.w || 1} ${box.h || 1}`} preserveAspectRatio="none">
          {threads.map((t) => (
            <path key={t.key} ref={(el) => { if (el) pathRefs.current.set(t.key, el); else pathRefs.current.delete(t.key); }}
              d={t.d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={t.width} strokeLinecap="round" className={t.side === "debit" ? "text-accent" : "text-info"} />
          ))}
        </svg>
        <div className="ink-col"><h3>Debit</h3>{debits.map(card("debit"))}</div>
        <div ref={docRef} className="ink-doc">
          <p className="text-xs text-muted">{sourceLabel(journal.source_type)}</p>
          <p className="code text-md font-medium" translate="no">{journal.entry_no}</p>
          <p className="text-xs text-muted">{date(journal.entry_date)}</p>
          <p className="mt-1.5 line-clamp-3 text-xs">{journal.description}</p>
          <div className="mt-2 flex justify-center">
            <span ref={scaleRef} className={balanced ? "ink-scale text-ink" : "ink-scale text-bad"} style={balanced ? undefined : { transform: "rotate(-14deg)" }}><Glyph name="timbangan" size={28} /></span>
          </div>
        </div>
        <div className="ink-col"><h3>Kredit</h3>{credits.map(card("credit"))}</div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p ref={sumRef} className={balanced ? "font-medium text-good" : "font-medium text-bad"} role={balanced ? undefined : "alert"}>
          {balanced
            ? <>Debit <span className="font-num">{idr(dSum)}</span> = Kredit <span className="font-num">{idr(cSum)}</span> · Seimbang</>
            : <>Tidak seimbang, selisih <span className="font-num">{idr(Math.abs(dSum - cSum))}</span></>}
        </p>
        {/* Mode Dikurangi dan Minimal langsung menampilkan keadaan akhir, jadi tidak ada yang bisa diputar ulang. */}
        {motionLevel() === "full" && <button type="button" className="btn btn-text btn-sm" onClick={run}><Glyph name="putar-ulang" size={16} />Putar ulang</button>}
      </figcaption>
      <table className="tbl dense mt-3" aria-label={`Baris jurnal ${journal.entry_no}`}>
        <thead><tr><th>Akun</th><th className="text-right">Debit</th><th className="text-right">Kredit</th></tr></thead>
        <tbody>{journal.lines.map((l, i) => (
          <tr key={i}><td><span className="code" translate="no">{l.account_code}</span> {l.account_name}{l.memo ? <span className="text-muted max-sm:hidden"> · {l.memo}</span> : null}</td>
            <td className="num">{cents(l.debit) ? idr(cents(l.debit)) : ""}</td><td className="num">{cents(l.credit) ? idr(cents(l.credit)) : ""}</td></tr>
        ))}</tbody>
        <tfoot><tr className="total"><td>Total</td><td className="num">{idr(dSum)}</td><td className="num">{idr(cSum)}</td></tr></tfoot>
      </table>
    </figure>
  );
}
