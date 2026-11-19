import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import { num, qty } from "../../lib/format";
import { Glyph } from "../glyphs";
import "./WarehouseIso.css";

/** Satu saldo stok dari /inventory/balances. */
export interface StockRow {
  branch_id: number; product_id: number; sku: string; name: string; uom?: string;
  on_hand: string | number; reserved: string | number; available: string | number; reorder_point: string | number; is_low: boolean; value?: string | number;
}
export type Level = "aman" | "menipis" | "habis";
export const LEVEL_TEXT: Record<Level, string> = { aman: "Aman", menipis: "Menipis", habis: "Habis" };
export const LEVEL_TONE: Record<Level, "ok" | "warn" | "bad"> = { aman: "ok", menipis: "warn", habis: "bad" };
export const LEVEL_GLYPH = { aman: "berhasil", menipis: "peringatan", habis: "gagal" } as const;
export const levelOf = (r: StockRow): Level => (num(r.available) <= 0 ? "habis" : r.is_low ? "menipis" : "aman");

const S = 14;     // satuan isometrik dalam piksel
const W = 1.6;    // tapak kotak
const PITCH = 4.6; // jarak antar-slot di rak
const H = 2.8;    // tinggi penuh
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * 0.866 * S, (x + y) * 0.5 * S - z * S];
const poly = (...pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

interface Box { row: StockRow; level: Level; fill: number; scale: "rop" | "relatif"; x: number; rack: number; slot: number; index: number }

/**
 * M8 Gudang Hidup: gambaran stok seketika per gudang (SVG isometrik). Sistem tidak menyimpan lokasi rak, jadi rak
 * disusun per kategori (kelompok logis, satu baris per kategori), bukan denah fisik. Tingkat isi = tersedia ÷ (2 × titik pesan
 * ulang), maksimal penuh; tanpa titik pesan ulang, relatif terhadap stok terbesar di kategori itu. Warna status + glyph + SKU.
 * Hover atau fokus mengangkat kotak 2 px dan menampilkan slip; klik atau Enter membuka laci produk; panah berpindah antar kotak.
 */
export function WarehouseIso({ rows, categoryOf, title, onOpen, show = "semua", compact }: {
  rows: StockRow[]; categoryOf: (productId: number) => string; title: string; onOpen?: (r: StockRow) => void; show?: Level | "semua"; compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const racks = useMemo(() => {
    const byCat = new Map<string, StockRow[]>();
    for (const r of rows) byCat.set(categoryOf(r.product_id), [...(byCat.get(categoryOf(r.product_id)) ?? []), r]);
    let index = 0;
    return [...byCat.keys()].sort((a, b) => a.localeCompare(b, "id")).map((name, ri) => {
      const list = byCat.get(name)!.sort((a, b) => a.sku.localeCompare(b.sku));
      const maxAvail = Math.max(1, ...list.map((r) => num(r.available)));
      const boxes: Box[] = list.map((r, si) => {
        const rop = num(r.reorder_point);
        const level = levelOf(r);
        const fill = level === "habis" ? 0 : rop > 0 ? Math.min(1, num(r.available) / (2 * rop)) : Math.min(1, num(r.available) / maxAvail);
        return { row: r, level, fill, scale: rop > 0 ? "rop" : "relatif", x: 0.8 + si * PITCH, rack: ri, slot: si, index: index++ };
      });
      return { name, boxes, len: 0.8 + list.length * PITCH - (PITCH - W) + 0.8 };
    });
  }, [rows, categoryOf]);
  const boxes = racks.flatMap((r) => r.boxes);
  if (boxes.length === 0) return null;

  function focusBox(i: number) {
    setActive(i);
    (wrapRef.current?.querySelector(`[data-box="${i}"]`) as SVGGElement | null)?.focus();
  }
  function move(b: Box, e: React.KeyboardEvent) {
    let next = b.index;
    if (e.key === "ArrowRight") next = Math.min(boxes.length - 1, b.index + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, b.index - 1);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const rack = racks[b.rack + (e.key === "ArrowDown" ? 1 : -1)];
      if (rack) next = rack.boxes[Math.min(b.slot, rack.boxes.length - 1)]!.index;
    } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(b.row); return; }
    else if (e.key === "Escape") { setHover(null); return; }
    else return;
    e.preventDefault();
    focusBox(next);
  }
  function slipAt(i: number) {
    const g = wrapRef.current?.querySelector(`[data-box="${i}"] .wh-hit`) as SVGGraphicsElement | null;
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = g?.getBoundingClientRect();
    if (!r || !wrap) return;
    setHover({ i, x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top });
  }
  const hb = hover ? boxes[hover.i] : null;

  return (
    <div ref={wrapRef} className="relative grid gap-1" role="group" aria-label={`${title}: ${boxes.length} produk, disusun per kategori, bukan denah fisik`}>
      {racks.map((rack) => {
        // Tiap rak memakai kotak pandangnya sendiri: slab, bingkai kapasitas, lalu kotak dari belakang ke depan.
        const corners = [P(0, -0.4), P(rack.len, -0.4), P(rack.len, W + 0.4), P(0, W + 0.4)];
        const minX = Math.min(...corners.map((c) => c[0])) - 36, maxX = Math.max(...corners.map((c) => c[0])) + 36;
        const minY = Math.min(...corners.map((c) => c[1])) - H * S - 8, maxY = Math.max(...corners.map((c) => c[1])) + 22;
        return (
          <div key={rack.name} className={clsx("grid items-center gap-3", compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[104px_minmax(0,1fr)]")}>
            <p className="text-right text-xs font-semibold text-muted">{rack.name}<span className="block font-normal">{rack.boxes.length} produk</span></p>
            <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-auto w-full" style={{ maxWidth: Math.round((maxX - minX) * (compact ? 0.85 : 1.1)) }} aria-hidden={false}>
              <polygon className="wh-slab" points={poly(...corners)} />
              {rack.boxes.map((b) => {
                const [x0, y0, x1, y1] = [b.x, 0, b.x + W, W];
                const h = b.level === "habis" ? 0.12 : Math.max(0.2, b.fill * H);
                const dim = show !== "semua" && show !== b.level;
                const [lx, ly] = P(x0 + W / 2, y1, 0);
                return (
                  <g key={b.row.sku + b.row.branch_id} data-box={b.index} className={clsx("wh-box", LEVEL_TONE[b.level], dim && "dim", hover?.i === b.index && "on")}
                    tabIndex={b.index === active ? 0 : -1} role="button"
                    aria-label={`${b.row.sku} ${b.row.name}: ${LEVEL_TEXT[b.level]}, tersedia ${qty(b.row.available)}${num(b.row.reorder_point) > 0 ? ` dari titik pesan ulang ${qty(b.row.reorder_point)}` : ""}`}
                    onClick={() => onOpen?.(b.row)} onKeyDown={(e) => move(b, e)}
                    onMouseEnter={() => slipAt(b.index)} onMouseLeave={() => setHover(null)} onFocus={() => { setActive(b.index); slipAt(b.index); }} onBlur={() => setHover(null)}>
                    <polygon className="wh-frame" points={poly(P(x0, y1, H), P(x1, y1, H), P(x1, y0, H), P(x0, y0, H))} />
                    <polyline className="wh-frame" points={poly(P(x0, y1, 0), P(x0, y1, H))} />
                    <polyline className="wh-frame" points={poly(P(x1, y1, 0), P(x1, y1, H))} />
                    <polyline className="wh-frame" points={poly(P(x1, y0, 0), P(x1, y0, H))} />
                    <g className="wh-lift">
                      <polygon className="wh-left" points={poly(P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h))} />
                      <polygon className="wh-right" points={poly(P(x1, y1, 0), P(x1, y0, 0), P(x1, y0, h), P(x1, y1, h))} />
                      <polygon className="wh-shade" points={poly(P(x1, y1, 0), P(x1, y0, 0), P(x1, y0, h), P(x1, y1, h))} />
                      <polygon className="wh-top" points={poly(P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h))} />
                    </g>
                    <polygon className="wh-hit" points={poly(P(x0, y1, 0), P(x1, y1, 0), P(x1, y0, 0), P(x1, y0, H), P(x0, y0, H), P(x0, y1, H))} />
                    <text className="wh-label" x={lx} y={ly + 15} textAnchor="middle">{b.row.sku}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
      {hb && hover && (
        <div className="wh-slip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
          <p className="flex items-center gap-1 font-medium"><Glyph name={LEVEL_GLYPH[hb.level]} size={13} /><span className="code">{hb.row.sku}</span> · {LEVEL_TEXT[hb.level]}</p>
          <p className="text-muted">{hb.row.name}</p>
          <p className="font-num">Tersedia {qty(hb.row.available)}{num(hb.row.reorder_point) > 0 ? ` · titik pesan ulang ${qty(hb.row.reorder_point)}` : ""}</p>
          <p className="text-muted">{hb.scale === "rop" ? "Isi penuh = 2 × titik pesan ulang" : "Tanpa titik pesan ulang: relatif terhadap stok terbesar di kategori"}</p>
        </div>
      )}
    </div>
  );
}
