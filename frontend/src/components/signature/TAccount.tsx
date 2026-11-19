import { useEffect, useRef } from "react";
import { date, rupiah } from "../../lib/format";
import { cents, openJournal } from "../../lib/journals";
import { drawStroke } from "../../motion/animate";

export interface GLData {
  account: { code: string; name: string; normal_balance: string };
  opening_balance: string;
  closing_balance: string;
  lines: { date: string; entry_no: string; description: string; memo: string | null; debit: string; credit: string; balance: string }[];
}

const idr = (c: number) => rupiah(c / 100, c % 100 !== 0);

/**
 * M7 Akun T: huruf T besar dari garis tinta. Debit di kiri, kredit di kanan, saldo awal di atas sisi saldo normalnya,
 * saldo akhir di bawah dengan garis ganda. Saldo akhir yang tampil adalah nilai dari API (closing_balance), jadi selalu
 * sama dengan tampilan buku besar; bila jumlah sisi T tidak cocok dengannya, peringatan tampil. Setiap entri membuka laci jurnal.
 * Gerak hanya saat berganti tampilan: garis T tergambar --dur-t-draw.
 */
export function TAccount({ gl }: { gl: GLData }) {
  const top = useRef<SVGLineElement>(null);
  const mid = useRef<SVGLineElement>(null);
  useEffect(() => {
    drawStroke(top.current, { duration: "dur-t-draw" });
    drawStroke(mid.current, { duration: "dur-t-draw", delay: 0 });
  }, []);

  const debitNormal = gl.account.normal_balance === "DEBIT";
  const opening = cents(gl.opening_balance);
  // Saldo awal di sisi saldo normal bila positif, di sisi lawan bila negatif.
  const openSide: "debit" | "credit" = (opening >= 0) === debitNormal ? "debit" : "credit";
  const debits = gl.lines.filter((l) => cents(l.debit) > 0);
  const credits = gl.lines.filter((l) => cents(l.credit) > 0);
  const dTotal = debits.reduce((s, l) => s + cents(l.debit), 0) + (openSide === "debit" ? Math.abs(opening) : 0);
  const cTotal = credits.reduce((s, l) => s + cents(l.credit), 0) + (openSide === "credit" ? Math.abs(opening) : 0);
  const closing = cents(gl.closing_balance);
  const computed = (dTotal - cTotal) * (debitNormal ? 1 : -1);
  const closeSide: "debit" | "credit" = (closing >= 0) === debitNormal ? "debit" : "credit";

  const Entry = ({ l, side }: { l: GLData["lines"][number]; side: "debit" | "credit" }) => (
    <li>
      <button type="button" onClick={() => openJournal({ entryNo: l.entry_no, date: l.date })}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded px-1 py-1 text-left text-table hover:bg-highlight">
        <span className="text-xs text-muted">{date(l.date)}</span>
        <span className="truncate"><span className="code" translate="no">{l.entry_no}</span> <span className="text-muted">{l.description}</span></span>
        <span className="font-num">{idr(cents(side === "debit" ? l.debit : l.credit))}</span>
      </button>
    </li>
  );
  const Opening = () => (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 px-1 py-1 text-table"><span className="font-medium">Saldo awal</span><span className="font-num font-medium">{idr(Math.abs(opening))}</span></li>
  );

  return (
    <figure aria-label={`Akun T ${gl.account.code} ${gl.account.name}`}>
      <figcaption className="mb-2 text-center">
        <span className="code text-md font-medium" translate="no">{gl.account.code}</span> <span className="font-serif text-lg font-medium">{gl.account.name}</span>
        <span className="block text-xs text-muted">Saldo normal {debitNormal ? "debit" : "kredit"}</span>
      </figcaption>
      <div className="relative">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-ink" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line ref={top} x1="0" y1="0.5" x2="100" y2="0.5" pathLength={1} stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line ref={mid} x1="50" y1="0.5" x2="50" y2="100" pathLength={1} stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="grid grid-cols-2 gap-x-6 pt-3">
          <div className="pr-2">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Debit</h3>
            <ul>{openSide === "debit" && opening !== 0 && <Opening />}{debits.map((l, i) => <Entry key={i} l={l} side="debit" />)}</ul>
          </div>
          <div className="pl-2">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Kredit</h3>
            <ul>{openSide === "credit" && opening !== 0 && <Opening />}{credits.map((l, i) => <Entry key={i} l={l} side="credit" />)}</ul>
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 border-t border-ink pt-2 text-table">
        <p className="flex justify-between px-1"><span className="text-muted">Jumlah debit</span><span className="font-num">{idr(dTotal)}</span></p>
        <p className="flex justify-between px-1"><span className="text-muted">Jumlah kredit</span><span className="font-num">{idr(cTotal)}</span></p>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-6 text-table">
        <p className={closeSide === "debit" ? "flex justify-between border-b-[3px] border-double border-ink px-1 pb-1 font-semibold" : ""}>{closeSide === "debit" && <><span>Saldo akhir</span><span className="font-num">{idr(Math.abs(closing))}</span></>}</p>
        <p className={closeSide === "credit" ? "flex justify-between border-b-[3px] border-double border-ink px-1 pb-1 font-semibold" : ""}>{closeSide === "credit" && <><span>Saldo akhir</span><span className="font-num">{idr(Math.abs(closing))}</span></>}</p>
      </div>
      {computed !== closing && <p role="alert" className="mt-2 text-table text-bad">Jumlah sisi T ({idr(computed)}) tidak sama dengan saldo akhir buku besar ({idr(closing)}). Angka resmi adalah buku besar.</p>}
    </figure>
  );
}
