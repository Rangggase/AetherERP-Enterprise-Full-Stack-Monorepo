import { useMemo, useState } from "react";
import { qty } from "../lib/format";

/** One stock balance, as returned by /inventory/balances. */
export interface PlanRow {
  branch_id: number;
  sku: string;
  name: string;
  on_hand: number | string;
  available: number | string;
  reorder_point: number | string;
  is_low: boolean;
}

type Level = "aman" | "menipis" | "habis";
const LABEL: Record<Level, string> = { aman: "Aman", menipis: "Menipis", habis: "Habis" };
/** Fill colours of the racks (docs/design-system.md). Text never uses these; it uses ink and muted. */
const FILL: Record<Level, string> = { aman: "#3F6B4E", menipis: "#B07A1E", habis: "#9E3B32" };

const MAX_RACKS = 12; // per zone; the table below lists every row
const COLS = 4;
const W = 2.2; // rack footprint
const GAP = 1.6;
const H = 2.4; // rack height (z units)
const SX = 32, SY = 16, SZ = 30;

const mix = (hex: string, to: number, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return `rgb(${c.join(",")})`;
};

const levelOf = (r: PlanRow): Level => (Number(r.available) <= 0 ? "habis" : r.is_low ? "menipis" : "aman");
const ratioOf = (r: PlanRow, l: Level) => {
  if (l === "habis") return 0;
  const rp = Number(r.reorder_point);
  return Math.max(0.12, Math.min(1, Number(r.available) / (rp > 0 ? rp * 3 : Number(r.available) || 1)));
};

interface Rack { key: string; sku: string; name: string; level: Level; ratio: number; available: number; gx: number; gy: number }

function Zone({ title, rows }: { title: string; rows: PlanRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const shown = rows.slice(0, MAX_RACKS);
  const racks: Rack[] = shown.map((r, i) => {
    const l = levelOf(r);
    return { key: r.sku, sku: r.sku, name: r.name, level: l, ratio: ratioOf(r, l), available: Number(r.available), gx: 0.8 + (i % COLS) * (W + GAP), gy: 0.8 + Math.floor(i / COLS) * (W + GAP) };
  });
  const cols = Math.min(COLS, racks.length);
  const lines = Math.ceil(racks.length / COLS);
  const fw = 0.8 * 2 + cols * W + (cols - 1) * GAP;
  const fd = 0.8 * 2 + lines * W + (lines - 1) * GAP;
  // Fit the viewBox to the floor corners, with room above for rack height and labels.
  const pt = (x: number, y: number, z = 0) => [(x - y) * SX, (x + y) * SY - z * SZ] as const;
  const corners = [pt(0, 0), pt(fw, 0), pt(fw, fd), pt(0, fd)];
  const minX = Math.min(...corners.map((c) => c[0])) - 12, maxX = Math.max(...corners.map((c) => c[0])) + 12;
  const minY = Math.min(...corners.map((c) => c[1])) - 104, maxY = Math.max(...corners.map((c) => c[1])) + 52;
  const P = (pts: (readonly [number, number])[]) => pts.map((p) => p.join(",")).join(" ");
  // Racks further back are drawn first; the active one is drawn last so its label is never covered.
  const order = [...racks].sort((a, b) => (a.key === active ? 1 : b.key === active ? -1 : a.gx + a.gy - (b.gx + b.gy)));
  const bad = shown.filter((r) => levelOf(r) !== "aman").length;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-table font-medium">{title}<span className="ml-2 font-normal text-muted">{shown.length} rak{bad ? ` · ${bad} perlu perhatian` : ""}</span></figcaption>
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-auto w-full" style={{ maxWidth: Math.round((maxX - minX) * 0.85) }} role="group" aria-label={`Denah gudang ${title}`}>
        <polygon points={P(corners)} fill="rgb(238 234 225)" stroke="#6B645A" strokeWidth={1} />
        {order.map((r) => {
          const x0 = r.gx, y0 = r.gy, x1 = x0 + W, y1 = y0 + W;
          const fillH = r.level === "habis" ? 0.14 : r.ratio * H;
          const base = FILL[r.level];
          const on = active === r.key;
          const [lx, ly] = pt(x0 + W / 2, y1, fillH + 0.1);
          const top = pt(x0 + W / 2, y0 + W / 2, fillH);
          return (
            <g key={r.key} tabIndex={0} role="img" className="rack outline-none"
              aria-label={`${r.sku} ${r.name}: ${LABEL[r.level]}, tersedia ${qty(r.available)}`}
              onMouseEnter={() => setActive(r.key)} onMouseLeave={() => setActive((a) => (a === r.key ? null : a))}
              onFocus={() => setActive(r.key)} onBlur={() => setActive((a) => (a === r.key ? null : a))}>
              {/* Empty rack frame, then the filled part. */}
              <polygon points={P([pt(x0, y1, H), pt(x0, y1), pt(x1, y1), pt(x1, y1, H)])} fill="none" stroke="#6B645A" strokeWidth={1} />
              <polygon points={P([pt(x1, y0, H), pt(x1, y0), pt(x1, y1), pt(x1, y1, H)])} fill="none" stroke="#6B645A" strokeWidth={1} />
              <g className="rack-body" style={on ? undefined : undefined}>
                <polygon points={P([pt(x0, y1, fillH), pt(x1, y1, fillH), pt(x1, y0, fillH), pt(x0, y0, fillH)])} fill={mix(base, 255, 0.38)} stroke="#1E1B18" strokeWidth={0.75} />
                <polygon points={P([pt(x0, y1, fillH), pt(x0, y1), pt(x1, y1), pt(x1, y1, fillH)])} fill={base} stroke="#1E1B18" strokeWidth={0.75} />
                <polygon points={P([pt(x1, y0, fillH), pt(x1, y0), pt(x1, y1), pt(x1, y1, fillH)])} fill={mix(base, 0, 0.28)} stroke="#1E1B18" strokeWidth={0.75} />
              </g>
              <text x={lx} y={ly + 16} textAnchor="middle" fontSize={14} fontWeight={600} fill="rgb(30 27 24)" className="plan-label">{r.sku}</text>
              <text x={lx} y={ly + 31} textAnchor="middle" fontSize={13} fill="rgb(107 100 90)" className="plan-label">{LABEL[r.level]}</text>
              {on && (
                <g className="plan-qty" pointerEvents="none">
                  <rect x={top[0] - 62} y={top[1] - 50} width={124} height={34} rx={4} fill="rgb(251 250 246)" stroke="#1E1B18" strokeWidth={1} />
                  <text x={top[0]} y={top[1] - 36} textAnchor="middle" fontSize={12} fill="rgb(107 100 90)">Tersedia</text>
                  <text x={top[0]} y={top[1] - 22} textAnchor="middle" fontSize={14} fontWeight={600} fill="rgb(30 27 24)" className="font-num">{qty(r.available)}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {rows.length > shown.length && <p className="mt-1 text-xs text-muted">Denah menampilkan {shown.length} dari {rows.length} SKU; sisanya ada di tabel.</p>}
    </figure>
  );
}

/** Isometric stock plan per warehouse. Shown only when there are balances; hidden below md, where the table is the view. */
export function WarehousePlan({ rows, branchName }: { rows: PlanRow[]; branchName: (id: number) => string }) {
  const zones = useMemo(() => {
    const m = new Map<number, PlanRow[]>();
    for (const r of rows) m.set(r.branch_id, [...(m.get(r.branch_id) ?? []), r]);
    return [...m.entries()];
  }, [rows]);
  if (!zones.length) return null;
  return (
    <section aria-label="Denah gudang" className="mb-6 hidden border-y border-line py-4 md:block">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-table text-muted">
        <span className="font-medium text-ink">Denah stok</span>
        {(Object.keys(LABEL) as Level[]).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5"><span aria-hidden style={{ background: FILL[l] }} className="inline-block h-2.5 w-2.5" />{LABEL[l]}</span>
        ))}
        <span>Sorot atau fokus rak untuk melihat jumlah. Tinggi isi menunjukkan stok tersedia terhadap titik pesan ulang.</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {zones.map(([id, r]) => <Zone key={id} title={branchName(id)} rows={r} />)}
      </div>
    </section>
  );
}
